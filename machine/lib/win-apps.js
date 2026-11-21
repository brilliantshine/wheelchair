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

function windowsScript(apps) {
  const data = Buffer.from(JSON.stringify(apps)).toString('base64');
  return script('appwindows', { apps }, `
$ErrorActionPreference='Stop'
$a = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')) | ConvertFrom-Json
Add-Type -TypeDefinition @'
using System; using System.Collections.Generic; using System.Text; using System.Runtime.InteropServices;
public static class WcWindows {
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr OpenJobObject(uint access, bool inherit, string name);
  [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job, int cls, IntPtr data, int len, out int returned);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  delegate bool Callback(IntPtr h, IntPtr param);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb, IntPtr param);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder text, int max);
  public class Window { public string handle; public string title; public uint pid; public string app_id; public bool minimized; }
  public static Window[] List(string[] ids) {
    var owners = new Dictionary<uint,string>();
    foreach (string id in ids) {
      IntPtr job = OpenJobObject(4, false, "wheelchair-" + id); if (job == IntPtr.Zero) continue;
      IntPtr data = Marshal.AllocHGlobal(65536);
      try {
        int returned;
        if (!QueryInformationJobObject(job, 3, data, 65536, out returned)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        int count = Marshal.ReadInt32(data, 4);
        for (int i = 0; i < count; i++) owners[(uint)Marshal.ReadIntPtr(data, 8 + i * IntPtr.Size).ToInt64()] = id;
      } finally { Marshal.FreeHGlobal(data); CloseHandle(job); }
    }
    var windows = new List<Window>();
    EnumWindows((h, _) => {
      if (!IsWindowVisible(h)) return true;
      uint pid; GetWindowThreadProcessId(h, out pid); string id;
      if (!owners.TryGetValue(pid, out id)) return true;
      var title = new StringBuilder(32768); GetWindowText(h, title, title.Capacity);
      windows.Add(new Window {handle = h.ToInt64().ToString(), title = title.ToString(), pid = pid, app_id = id, minimized = IsIconic(h)}); return true;
    }, IntPtr.Zero);
    return windows.ToArray();
  }
}
'@
$items = @([WcWindows]::List([string[]]@($a | ForEach-Object { $_.id })))
ConvertTo-Json -InputObject $items -Depth 5 -Compress
`);
}

function shotScript(handle, destination) {
  const args = { handle, destination };
  const data = Buffer.from(JSON.stringify(args)).toString('base64');
  return script('appshot', args, `
$ErrorActionPreference='Stop'
$a = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')) | ConvertFrom-Json
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class WcShot {
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
  public static void Save(long value, string dest) {
    var h = new IntPtr(value); if (IsIconic(h)) throw new Exception("window is minimized");
    RECT r; if (!GetWindowRect(h, out r) || r.Right <= r.Left || r.Bottom <= r.Top) throw new Exception("window has no size");
    using (var bitmap = new Bitmap(r.Right-r.Left, r.Bottom-r.Top)) {
      using (var g = Graphics.FromImage(bitmap)) { var dc = g.GetHdc(); try { if (!PrintWindow(h, dc, 2)) throw new Exception("PrintWindow failed"); } finally { g.ReleaseHdc(dc); } }
      bitmap.Save(dest, ImageFormat.Png);
    }
  }
}
'@
[WcShot]::Save([long]::Parse([string]$a.handle), [string]$a.destination)
`);
}

function cleanupScript(app) {
  const args = { pid: app.pid, created: app.created, wrapper_pid: app.wrapper_pid, wrapper_created: app.wrapper_created };
  const data = Buffer.from(JSON.stringify(args)).toString('base64');
  return script('appcleanup', args, `
$ErrorActionPreference='Stop'
$a = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')) | ConvertFrom-Json
function Stop-Matching([int]$pidValue, [string]$created) {
  if ($pidValue -le 0 -or -not $created) { return }
  $p = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
  if ($null -eq $p) { return }
  try { $actual = $p.StartTime.ToUniversalTime().ToFileTimeUtc().ToString() } catch { throw "cannot check process creation time: $_" }
  if ($actual -ne $created) { return }
  & taskkill.exe /PID $pidValue /T /F | Out-Null
  if ($LASTEXITCODE -ne 0 -and (Get-Process -Id $pidValue -ErrorAction SilentlyContinue)) { throw "cannot stop process $pidValue" }
  try { $p.WaitForExit(5000) | Out-Null } catch {}
}
Stop-Matching $a.wrapper_pid $a.wrapper_created
Stop-Matching $a.pid $a.created
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

  async startup() {
    try {
      const json = fs.readFileSync(this.file, 'utf8').replace(/("(?:created|wrapper_created)":\s*)(\d+)/g, '$1"$2"');
      this.apps = JSON.parse(json);
    } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    for (const app of this.apps) {
      if (!app.running || this.children.has(app.id)) continue;
      const result = await this.winEnv.ps(cleanupScript(app));
      if (result.code) throw error(result.stderr || 'failed to clean up Windows app');
      app.running = false;
      app.exit_code = null;
      this.save();
    }
  }

  async sweep(liveNames) {
    const dead = this.apps.filter(app => app.running && !liveNames.has(app.session));
    await Promise.all(dead.map(app => this.terminate(app)));
    return { copyKeys: [...new Set(dead.map(app => app.copyKey).filter(k => k != null))] };
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

  async windows(session) {
    const apps = this.apps.filter(a => a.session === session.name && a.running).map(a => ({ id: a.id }));
    if (!apps.length) return { windows: [] };
    const result = await this.winEnv.ps(windowsScript(apps));
    if (result.code) throw error(result.stderr || 'failed to enumerate windows');
    return { windows: JSON.parse(result.stdout.trim() || '[]') };
  }

  async shot(session, handle) {
    const found = (await this.windows(session)).windows.find(w => String(w.handle) === String(handle));
    if (!found) throw error('unknown window', 400);
    if (found.minimized) throw error('window is minimized');
    const dir = path.join(this.root, session.name, 'shots');
    fs.mkdirSync(dir, { recursive: true });
    let n = Date.now();
    while (fs.existsSync(path.join(dir, `${n}.png`))) n++;
    const target = path.join(dir, `${n}.png`);
    const result = await this.winEnv.ps(shotScript(String(handle), this.winEnv.toWindows(target)));
    if (result.code) throw error(result.stderr || 'failed to capture window');
    const shots = fs.readdirSync(dir).filter(f => /^\d+\.png$/.test(f)).sort((a, b) => Number(b.slice(0, -4)) - Number(a.slice(0, -4)));
    for (const old of shots.slice(50)) fs.unlinkSync(path.join(dir, old));
    return { path: target };
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
