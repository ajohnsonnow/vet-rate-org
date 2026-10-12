param([Parameter(Mandatory = $true)][string]$Luids)
# Streams "GPU Adapter Memory" counters for the given LUIDs (comma list of 0xHHHHHHHH_0xLLLLLLLL), one line per sample:
#   <counter path>|<bytes>
$paths = foreach ($l in $Luids.Split(',')) {
  "\GPU Adapter Memory(luid_${l}_phys_0)\Dedicated Usage"
  "\GPU Adapter Memory(luid_${l}_phys_0)\Shared Usage"
}
Get-Counter -Counter $paths -SampleInterval 1 -Continuous | ForEach-Object {
  foreach ($s in $_.CounterSamples) { "$($s.Path)|$([int64]$s.CookedValue)" }
  [Console]::Out.Flush()
}
