$ProgressPreference = 'SilentlyContinue'
$ErrorActionPreference = 'Stop'
$out = [Console]::OpenStandardOutput()
$client = [System.Net.Sockets.TcpClient]::new([System.Net.Sockets.AddressFamily]::InterNetwork)
function Header([string] $line) {
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($line + "`n")
    $out.Write($bytes, 0, $bytes.Length)
    $out.Flush()
}
try {
    $connect = $client.ConnectAsync('127.0.0.1', $ToolPort)
    try {
        if (-not $connect.Wait(5000)) {
            Header 'REFUSED Windows refused the connection'
            return
        }
    } catch {
        $connectError = $_.Exception
        while ($connectError.InnerException) { $connectError = $connectError.InnerException }
        if ($connectError -is [System.Net.Sockets.SocketException] -and $connectError.SocketErrorCode -eq [System.Net.Sockets.SocketError]::ConnectionRefused) {
            Header "REFUSED nothing on Windows is listening on port $ToolPort"
        } else {
            Header 'REFUSED Windows refused the connection'
        }
        return
    }
    $remotePort = ([System.Net.IPEndPoint]$client.Client.LocalEndPoint).Port
    $owner = $null
    $process = $null
    try {
        $info = [System.Diagnostics.ProcessStartInfo]::new()
        $info.FileName = 'netstat.exe'
        $info.Arguments = '-ano'
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $process = [System.Diagnostics.Process]::Start($info)
        $lines = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(3000)) { throw 'owner lookup timed out' }
        if ($process.ExitCode -ne 0) { throw 'netstat failed' }
        $local = "127.0.0.1:$ToolPort"
        $remote = "127.0.0.1:$remotePort"
        $matches = @($lines.Result -split "`r?`n" | Where-Object {
            $parts = $_.Trim() -split '\s+'
            $parts.Length -ge 5 -and $parts[0] -eq 'TCP' -and $parts[1] -eq $local -and $parts[2] -eq $remote
        })
        if ($matches.Count -ne 1) { throw 'connection owner not found' }
        $parts = $matches[0].Trim() -split '\s+'
        $owner = (Get-Process -Id ([int]$parts[-1]) -ErrorAction Stop).ProcessName
    } catch {
        Header "REFUSED couldn't check who holds port $ToolPort on Windows"
        return
    } finally {
        if ($process) {
            if (-not $process.HasExited) { $process.Kill() }
            $process.Dispose()
        }
    }
    if ($owner -ieq 'wslrelay') {
        Header "REFUSED port $ToolPort on Windows leads back to Linux"
        return
    }
    if ($Mode -eq 'check') {
        $client.Close()
        Header 'OK'
        return
    }
    Header 'OK'
    Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Net.Sockets;
using System.Threading.Tasks;
public static class WheelchairRelay {
    private static async Task CopyOut(Stream input, Stream output) {
        byte[] buffer = new byte[65536];
        int n;
        while ((n = await input.ReadAsync(buffer, 0, buffer.Length).ConfigureAwait(false)) != 0) {
            await output.WriteAsync(buffer, 0, n).ConfigureAwait(false);
            await output.FlushAsync().ConfigureAwait(false);
        }
        await output.FlushAsync().ConfigureAwait(false);
    }
    public static void Run(TcpClient client, Stream input, Stream output) {
        var network = client.GetStream();
        var incoming = input.CopyToAsync(network);
        var outgoing = CopyOut(network, output);
        Task.WhenAny(incoming, outgoing).GetAwaiter().GetResult();
        client.Close();
    }
}
'@
    [WheelchairRelay]::Run($client, [Console]::OpenStandardInput(), $out)
} catch {
    [Console]::Error.WriteLine($_.Exception.ToString())
} finally {
    $client.Close()
}
