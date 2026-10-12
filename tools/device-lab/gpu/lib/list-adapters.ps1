# Lists DXGI adapters as JSON: name, vendor/device ids, LUID (high/low), dedicated and shared memory.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class DxgiList {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct DXGI_ADAPTER_DESC1 {
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string Description;
    public uint VendorId; public uint DeviceId; public uint SubSysId; public uint Revision;
    public UIntPtr DedicatedVideoMemory; public UIntPtr DedicatedSystemMemory; public UIntPtr SharedSystemMemory;
    public uint LuidLow; public int LuidHigh; public uint Flags;
  }
  [ComImport, Guid("770aae78-f26f-4dba-a829-253c83d1b387"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IDXGIFactory1 {
    void SetPrivateData(); void SetPrivateDataInterface(); void GetPrivateData(); void GetParent();
    void EnumAdapters(); void MakeWindowAssociation(); void GetWindowAssociation(); void CreateSwapChain(); void CreateSoftwareAdapter();
    [PreserveSig] int EnumAdapters1(uint index, out IDXGIAdapter1 adapter);
  }
  [ComImport, Guid("29038f61-3839-4626-91fd-086879011a05"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IDXGIAdapter1 {
    void SetPrivateData(); void SetPrivateDataInterface(); void GetPrivateData(); void GetParent();
    void EnumOutputs(); void GetDesc(); void CheckInterfaceSupport();
    [PreserveSig] int GetDesc1(out DXGI_ADAPTER_DESC1 desc);
  }
  [DllImport("dxgi.dll")] static extern int CreateDXGIFactory1(ref Guid riid, out IDXGIFactory1 factory);
  public static List<string> List() {
    var guid = new Guid("770aae78-f26f-4dba-a829-253c83d1b387");
    IDXGIFactory1 f; CreateDXGIFactory1(ref guid, out f);
    var res = new List<string>();
    for (uint i = 0; ; i++) {
      IDXGIAdapter1 a; if (f.EnumAdapters1(i, out a) != 0) break;
      DXGI_ADAPTER_DESC1 d; a.GetDesc1(out d);
      res.Add(string.Format("{{\"index\":{0},\"name\":\"{1}\",\"vendorId\":{2},\"deviceId\":{3},\"subSysId\":{4},\"luidHigh\":{5},\"luidLow\":{6},\"dedicatedBytes\":{7},\"sharedBytes\":{8},\"flags\":{9}}}",
        i, d.Description.Replace("\\", "\\\\").Replace("\"", "\\\""), d.VendorId, d.DeviceId, d.SubSysId, d.LuidHigh, d.LuidLow, d.DedicatedVideoMemory, d.SharedSystemMemory, d.Flags));
    }
    return res;
  }
}
'@
"[" + ([DxgiList]::List() -join ",") + "]"
