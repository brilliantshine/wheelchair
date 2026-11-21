'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function script(op, args, body) {
  const data = Buffer.from(JSON.stringify(args)).toString('base64');
  return `# wc:${op} ${data}\n${body}`;
}

function wrapperScript(args) {
  const data = Buffer.from(JSON.stringify(args)).toString('base64');
  return script('appwrap', args, `
$ErrorActionPreference = 'Stop'
$a = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')) | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;
public static class WcJob {
  [StructLayout(LayoutKind.Sequential)] public struct BASIC_LIMIT {
    public Int64 PerProcessUserTimeLimit, PerJobUserTimeLimit;
    public UInt32 LimitFlags;
    public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
    public UInt32 ActiveProcessLimit;
    public UIntPtr Affinity;
    public UInt32 PriorityClass, SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)] public struct IO_COUNTERS {
    public UInt64 ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount;
  }
  [StructLayout(LayoutKind.Sequential)] public struct EXTENDED_LIMIT {
    public BASIC_LIMIT BasicLimitInformation;
    public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
  }
  [StructLayout(LayoutKind.Sequential)] public struct ACCOUNTING {
    public Int64 TotalUserTime, TotalKernelTime, ThisPeriodTotalUserTime, ThisPeriodTotalKernelTime;
    public UInt32 TotalPageFaultCount, TotalProcesses, ActiveProcesses, TotalTerminatedProcesses;
  }
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern IntPtr CreateJobObject(IntPtr attr, string name);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool SetInformationJobObject(IntPtr job, int cls, ref EXTENDED_LIMIT info, int size);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool QueryInformationJobObject(IntPtr job, int cls, out ACCOUNTING info, int size, IntPtr returned);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool CloseHandle(IntPtr handle);
  public static void Check(bool ok) { if (!ok) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error()); }
  public static string Quote(string s) {
    if (s.Length > 0 && s.IndexOfAny(new char[]{' ', '\\t', '\\n', '\\v', '"'}) < 0) return s;
    var b = new System.Text.StringBuilder("\\\""); int slashes = 0;
    foreach (char c in s) {
      if (c == '\\\\') { slashes++; continue; }
      if (c == '"') { b.Append('\\\\', slashes * 2 + 1); b.Append(c); slashes = 0; continue; }
      b.Append('\\\\', slashes); slashes = 0; b.Append(c);
    }
    b.Append('\\\\', slashes * 2); b.Append('"'); return b.ToString();
  }
  public static void Run(string name, string program, string[] argv, string cwd, string[] keys, string[] values, string log) {
    IntPtr job = CreateJobObject(IntPtr.Zero, name);
    if (job == IntPtr.Zero) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      var limits = new EXTENDED_LIMIT(); limits.BasicLimitInformation.LimitFlags = 0x2000;
      Check(SetInformationJobObject(job, 9, ref limits, Marshal.SizeOf(typeof(EXTENDED_LIMIT))));
      Check(AssignProcessToJobObject(job, Process.GetCurrentProcess().Handle));
      var info = new ProcessStartInfo(program); info.UseShellExecute = false; info.CreateNoWindow = true;
      info.RedirectStandardOutput = true; info.RedirectStandardError = true; info.WorkingDirectory = cwd;
      info.Arguments = String.Join(" ", Array.ConvertAll(argv, Quote));
      for (int i=0; i<keys.Length; i++) info.EnvironmentVariables[keys[i]] = values[i];
      using (var output = new StreamWriter(new FileStream(log, FileMode.Create, FileAccess.Write, FileShare.ReadWrite)))
      using (var p = new Process()) {
        output.AutoFlush = true; object gate = new object();
        p.StartInfo = info;
        p.OutputDataReceived += (s,e) => { if (e.Data != null) lock(gate) output.WriteLine(e.Data); };
        p.ErrorDataReceived += (s,e) => { if (e.Data != null) lock(gate) output.WriteLine(e.Data); };
        p.Start(); p.BeginOutputReadLine(); p.BeginErrorReadLine();
        var me = Process.GetCurrentProcess();
        Console.WriteLine("{\\\"started\\\":{\\\"pid\\\":" + p.Id + ",\\\"created\\\":" + p.StartTime.ToUniversalTime().ToFileTimeUtc() + ",\\\"wrapper_pid\\\":" + me.Id + ",\\\"wrapper_created\\\":" + me.StartTime.ToUniversalTime().ToFileTimeUtc() + "}}");
        p.WaitForExit(); int code = p.ExitCode;
        ACCOUNTING count;
        do { Check(QueryInformationJobObject(job, 1, out count, Marshal.SizeOf(typeof(ACCOUNTING)), IntPtr.Zero)); if (count.ActiveProcesses > 1) System.Threading.Thread.Sleep(100); } while (count.ActiveProcesses > 1);
        Console.WriteLine("{\\\"done\\\":{\\\"exit_code\\\":" + code + "}}");
      }
    } finally { CloseHandle(job); }
  }
}
'@
$keys = @($a.env | ForEach-Object { [string]$_[0] })
$values = @($a.env | ForEach-Object { [string]$_[1] })
[WcJob]::Run(('wheelchair-' + $a.id), [string]$a.program, [string[]]@($a.argv), [string]$a.cwd, [string[]]$keys, [string[]]$values, [string]$a.log)
`);
}

function terminateScript(id) {
  return script('appterminate', { id }, `
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
public static class WcTerminate {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] public static extern IntPtr OpenJobObject(uint access, bool inherit, string name);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool TerminateJobObject(IntPtr job, uint code);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
}
'@
$h = [WcTerminate]::OpenJobObject(8, $false, 'wheelchair-${id}')
if ($h -ne [IntPtr]::Zero) { try { if (-not [WcTerminate]::TerminateJobObject($h, 1)) { throw 'TerminateJobObject failed' } } finally { [void][WcTerminate]::CloseHandle($h) } }
`);
}

function error(message, status = 422) { return Object.assign(new Error(message), { status }); }

class AppTracker {
  constructor({ winEnv, stateDir, log = () => {}, onAppClosed = () => {} }) {
    this.winEnv = winEnv;
    this.root = path.join(stateDir, 'win');
    this.file = path.join(this.root, 'apps.json');
    this.log = log;
    this.onAppClosed = onAppClosed;
    this.apps = [];
    this.children = new Map();
    this.exited = new Map();
  }

  save() {
    fs.mkdirSync(this.root, { recursive: true });
    const tmp = `${this.file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    const json = JSON.stringify(this.apps, null, 2).replace(/("(?:created|wrapper_created)": )"(\d+)"/g, '$1$2');
    fs.writeFileSync(tmp, json, { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  async launch(session, options, started) {
    const active = this.apps.filter(a => a.session === session.name && a.running && a.started);
    if (started && active.length >= 4) throw error('session already has 4 running started apps');
    const id = crypto.randomUUID();
    const dir = path.join(this.root, session.name, 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const log = path.join(dir, `${id}.log`);
    const args = { id, program: options.program, argv: options.argv || [],
      env: (options.env || []).filter(([key]) => key.toUpperCase() !== 'WHEELCHAIR_SESSION_TOKEN'),
      cwd: options.cwd, log: this.winEnv.toWindows(log) };
    const child = this.winEnv.spawnPs(wrapperScript(args));
    const app = { id, session: session.name, program: options.program, copyKey: options.copyKey,
      pid: null, created: null, wrapper_pid: null, wrapper_created: null, log, exit_code: null, running: true, started };
    this.apps.push(app);
    this.children.set(id, child);
    this.save();
    let resolveStart, rejectStart;
    const ready = new Promise((resolve, reject) => { resolveStart = resolve; rejectStart = reject; });
    let receivedStart = false;
    let buf = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      buf += chunk.toString();
      let newline;
      while ((newline = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, newline).trim(); buf = buf.slice(newline + 1);
        let msg;
        try { msg = JSON.parse(line.replace(/("(?:created|wrapper_created)":\s*)(\d+)/g, '$1"$2"')); } catch { continue; }
        if (msg.started && !receivedStart) {
          receivedStart = true;
          Object.assign(app, msg.started);
          this.save();
          resolveStart();
        }
        if (msg.done) { app.exit_code = msg.done.exit_code; this.save(); }
      }
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    let finish;
    const closed = new Promise(resolve => { finish = resolve; });
    let finished = false;
    const finishChild = cause => {
      if (finished) return;
      finished = true;
      this.children.delete(id);
      app.running = false;
      this.save();
      if (!this.exited.has(app.session)) this.exited.set(app.session, new Set());
      this.exited.get(app.session).add(id);
      try { this.onAppClosed(app); } catch (e) { this.log(e); }
      if (!receivedStart) rejectStart(error(`Windows app failed to start: ${cause || stderr.trim() || 'wrapper exited'}`));
      finish();
    };
    child.on('error', e => finishChild(e.message));
    child.on('close', () => finishChild());
    await ready;
    return { app, closed };
  }

  async start(session, options) {
    const { app } = await this.launch(session, options, true);
    return { id: app.id, pid: app.pid, log: app.log };
  }

  async run(session, options) {
    const { app, closed } = await this.launch(session, options, false);
    let timed_out = false;
    const timer = setTimeout(() => { timed_out = true; this.terminate(app).catch(this.log); }, (options.timeout || 540) * 1000);
    await closed;
    clearTimeout(timer);
    let output = Buffer.alloc(0);
    try {
      const size = fs.statSync(app.log).size;
      const fd = fs.openSync(app.log, 'r');
      try { output = Buffer.alloc(Math.min(size, 65536)); fs.readSync(fd, output, 0, output.length, size - output.length); } finally { fs.closeSync(fd); }
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
    return { exit_code: app.exit_code, timed_out, output: output.toString(), log: app.log };
  }

  status(session, id) {
    const apps = this.apps.filter(a => a.session === session.name && (!id || a.id === id));
    if (id && !apps.length) throw error('unknown app', 400);
    const changes = this.exited.get(session.name) || new Set();
    const exited = apps.filter(a => changes.has(a.id)).map(a => a.id);
    for (const appId of exited) changes.delete(appId);
    return { apps: apps.map(({ id, program, running, exit_code, log }) => ({ id, program, running, exit_code, log })), exited };
  }

  async terminate(app) {
    if (!app.running) return;
    const result = await this.winEnv.ps(terminateScript(app.id));
    if (result.code) throw error(result.stderr || 'failed to terminate job');
    const child = this.children.get(app.id);
    if (child) child.kill('SIGKILL');
  }

  async stop(session, id) {
    const selected = this.apps.filter(a => a.session === session.name && (!id || a.id === id));
    if (id && !selected.length) throw error('unknown app', 400);
    const running = selected.filter(a => a.running);
    await Promise.all(running.map(a => this.terminate(a)));
    return { stopped: running.map(a => a.id), wasRunning: !!running.length, copyKeys: [...new Set(running.map(a => a.copyKey).filter(k => k != null))] };
  }

  async killSession(name) {
    const { wasRunning, copyKeys } = await this.stop({ name }, null);
    return { wasRunning, copyKeys };
  }
}

module.exports = { AppTracker };
