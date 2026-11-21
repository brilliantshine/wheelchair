'use strict';

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

module.exports = { wrapperScript };
