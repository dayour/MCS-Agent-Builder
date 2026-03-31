using System.Runtime.InteropServices;
using NAudio.Wave;

namespace AudioCapture;

/// <summary>
/// Per-process Application Loopback capture using Windows AudioClient activation with
/// AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK. This targets a specific process ID
/// so we capture only Teams.exe audio, not all system audio.
/// Requires Windows 10 build 20348+ (Windows Server 2022 / Windows 11).
///
/// We define our own COM interop interfaces for IAudioClient and IAudioCaptureClient
/// because NAudio marks these as internal. The Windows audio APIs are COM-based,
/// so we P/Invoke ActivateAudioInterfaceAsync and then cast the result.
/// </summary>
public sealed class LoopbackCapture : IDisposable
{
    // ===================================================================
    // COM Interop definitions for per-process audio loopback
    // ===================================================================

    private const int AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK = 1;
    private const int PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE = 0;

    // AUDCLNT_SHAREMODE
    private const int AUDCLNT_SHAREMODE_SHARED = 0;

    // AUDCLNT_BUFFERFLAGS
    private const int AUDCLNT_BUFFERFLAGS_SILENT = 0x2;

    // VT_BLOB for PROPVARIANT
    private const ushort VT_BLOB = 65;

    // Wave format constants
    private const ushort WAVE_FORMAT_EXTENSIBLE = 0xFFFE;
    private const ushort WAVE_FORMAT_IEEE_FLOAT = 0x0003;
    private const ushort WAVE_FORMAT_PCM = 0x0001;

    // GUIDs
    private static readonly Guid IID_IAudioClient =
        new("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2");

    private static readonly Guid IID_IAudioCaptureClient =
        new("C8ADBD64-E71E-48A0-A4DE-185C395CD317");

    private static readonly Guid KSDATAFORMAT_SUBTYPE_IEEE_FLOAT =
        new("00000003-0000-0010-8000-00aa00389b71");

    private static readonly Guid KSDATAFORMAT_SUBTYPE_PCM =
        new("00000001-0000-0010-8000-00aa00389b71");

    // --- Structs ---

    [StructLayout(LayoutKind.Sequential)]
    private struct AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS
    {
        public uint TargetProcessId;
        public int ProcessLoopbackMode;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct AUDIOCLIENT_ACTIVATION_PARAMS
    {
        public int ActivationType;
        public AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS ProcessLoopbackParams;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct PROPVARIANT
    {
        public ushort vt;
        public ushort wReserved1;
        public ushort wReserved2;
        public ushort wReserved3;
        public int cbSize;
        public IntPtr pBlobData;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    private struct WAVEFORMATEX
    {
        public ushort wFormatTag;
        public ushort nChannels;
        public uint nSamplesPerSec;
        public uint nAvgBytesPerSec;
        public ushort nBlockAlign;
        public ushort wBitsPerSample;
        public ushort cbSize;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 1)]
    private struct WAVEFORMATEXTENSIBLE
    {
        public WAVEFORMATEX Format;
        public ushort wValidBitsPerSample;
        public uint dwChannelMask;
        public Guid SubFormat;
    }

    // --- COM Interfaces ---

    /// <summary>IAudioClient COM interface (vtable order matters).</summary>
    [ComImport]
    [Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioClientInterop
    {
        // IAudioClient methods in vtable order
        int Initialize(
            int ShareMode,
            uint StreamFlags,
            long hnsBufferDuration,
            long hnsPeriodicity,
            IntPtr pFormat,
            IntPtr AudioSessionGuid);

        int GetBufferSize(out uint pNumBufferFrames);

        int GetStreamLatency(out long phnsLatency);

        int GetCurrentPadding(out uint pNumPaddingFrames);

        int IsFormatSupported(
            int ShareMode,
            IntPtr pFormat,
            out IntPtr ppClosestMatch);

        int GetMixFormat(out IntPtr ppDeviceFormat);

        int GetDevicePeriod(out long phnsDefaultDevicePeriod, out long phnsMinimumDevicePeriod);

        int Start();

        int Stop();

        int Reset();

        int SetEventHandle(IntPtr eventHandle);

        int GetService([In, MarshalAs(UnmanagedType.LPStruct)] Guid riid,
            [MarshalAs(UnmanagedType.IUnknown)] out object ppv);
    }

    /// <summary>IAudioCaptureClient COM interface (vtable order matters).</summary>
    [ComImport]
    [Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAudioCaptureClientInterop
    {
        int GetBuffer(
            out IntPtr ppData,
            out uint pNumFramesToRead,
            out uint pdwFlags,
            out ulong pu64DevicePosition,
            out ulong pu64QPCPosition);

        int ReleaseBuffer(uint NumFramesRead);

        int GetNextPacketSize(out uint pNumFramesInNextPacket);
    }

    // --- Activation async operation and handler ---

    [ComImport]
    [Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IActivateAudioInterfaceAsyncOperation
    {
        void GetActivateResult(
            [MarshalAs(UnmanagedType.Error)] out int activateResult,
            [MarshalAs(UnmanagedType.IUnknown)] out object activatedInterface);
    }

    [ComImport]
    [Guid("41D949AB-9862-444A-80F6-C261334DA5EB")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IActivateAudioInterfaceCompletionHandler
    {
        void ActivateCompleted(IActivateAudioInterfaceAsyncOperation activateOperation);
    }

    // --- P/Invoke ---

    [DllImport("Mmdevapi.dll", ExactSpelling = true, PreserveSig = false)]
    private static extern int ActivateAudioInterfaceAsync(
        [In, MarshalAs(UnmanagedType.LPWStr)] string deviceInterfacePath,
        [In, MarshalAs(UnmanagedType.LPStruct)] Guid riid,
        [In] IntPtr activationParams,
        [In] IActivateAudioInterfaceCompletionHandler completionHandler,
        out IActivateAudioInterfaceAsyncOperation activateOperation);

    // --- Completion handler ---

    private class CompletionHandler : IActivateAudioInterfaceCompletionHandler
    {
        private readonly TaskCompletionSource<object> _tcs = new();
        public Task<object> Task => _tcs.Task;

        public void ActivateCompleted(IActivateAudioInterfaceAsyncOperation activateOperation)
        {
            try
            {
                activateOperation.GetActivateResult(out int hr, out object activatedInterface);
                if (hr < 0)
                    _tcs.SetException(Marshal.GetExceptionForHR(hr)
                        ?? new COMException($"ActivateAudioInterfaceAsync failed: 0x{hr:X8}"));
                else
                    _tcs.SetResult(activatedInterface);
            }
            catch (Exception ex)
            {
                _tcs.SetException(ex);
            }
        }
    }

    // ===================================================================
    // Instance members
    // ===================================================================

    private readonly int _targetPid;
    private readonly CancellationToken _ct;
    private IAudioClientInterop? _audioClient;
    private IAudioCaptureClientInterop? _captureClient;
    private WaveFormat? _captureFormat;
    private IntPtr _activationParamsPtr;
    private IntPtr _blobPtr;
    private IntPtr _waveFormatPtr;
    private bool _disposed;
    private volatile bool _capturing;
    private Thread? _captureThread;

    /// <summary>Fires when a buffer of audio data is available.</summary>
    public event Action<byte[], WaveFormat>? DataAvailable;

    /// <summary>Fires when capture stops (error or normal).</summary>
    public event Action<Exception?>? CaptureStopped;

    /// <summary>The wave format of the captured audio.</summary>
    public WaveFormat? WaveFormat => _captureFormat;

    public LoopbackCapture(int targetProcessId, CancellationToken ct = default)
    {
        _targetPid = targetProcessId;
        _ct = ct;
    }

    /// <summary>
    /// Activate the per-process loopback audio client via ActivateAudioInterfaceAsync.
    /// </summary>
    public async Task InitializeAsync()
    {
        // Build the activation params
        var loopbackParams = new AUDIOCLIENT_PROCESS_LOOPBACK_PARAMS
        {
            TargetProcessId = (uint)_targetPid,
            ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE
        };

        var activationParams = new AUDIOCLIENT_ACTIVATION_PARAMS
        {
            ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK,
            ProcessLoopbackParams = loopbackParams
        };

        // Marshal activation params into a PROPVARIANT (VT_BLOB)
        int paramsSize = Marshal.SizeOf<AUDIOCLIENT_ACTIVATION_PARAMS>();
        _blobPtr = Marshal.AllocHGlobal(paramsSize);
        Marshal.StructureToPtr(activationParams, _blobPtr, false);

        var propVariant = new PROPVARIANT
        {
            vt = VT_BLOB,
            cbSize = paramsSize,
            pBlobData = _blobPtr
        };

        _activationParamsPtr = Marshal.AllocHGlobal(Marshal.SizeOf<PROPVARIANT>());
        Marshal.StructureToPtr(propVariant, _activationParamsPtr, false);

        // Activate the audio interface for process loopback
        const string devicePath = @"VAD\Process_Loopback";
        var handler = new CompletionHandler();

        ActivateAudioInterfaceAsync(
            devicePath,
            IID_IAudioClient,
            _activationParamsPtr,
            handler,
            out _);

        // Wait for activation to complete
        var activated = await handler.Task.WaitAsync(TimeSpan.FromSeconds(10), _ct);
        _audioClient = (IAudioClientInterop)activated;

        // Get the mix format
        int hr = _audioClient.GetMixFormat(out IntPtr mixFormatPtr);
        Marshal.ThrowExceptionForHR(hr);

        _captureFormat = ParseWaveFormat(mixFormatPtr);
        _waveFormatPtr = mixFormatPtr; // keep alive for Initialize call

        Console.WriteLine($"[loopback] Device mix format: {_captureFormat.SampleRate}Hz, " +
                          $"{_captureFormat.BitsPerSample}-bit, {_captureFormat.Channels}ch, " +
                          $"encoding={_captureFormat.Encoding}");

        // Initialize audio client: shared mode, 100ms buffer
        const long bufferDuration = 1_000_000; // 100ms in 100ns units
        hr = _audioClient.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            0,
            bufferDuration,
            0,
            mixFormatPtr,
            IntPtr.Zero);
        Marshal.ThrowExceptionForHR(hr);

        // Get the capture client service
        hr = _audioClient.GetService(IID_IAudioCaptureClient, out object captureObj);
        Marshal.ThrowExceptionForHR(hr);
        _captureClient = (IAudioCaptureClientInterop)captureObj;
    }

    /// <summary>Start capturing audio on a background thread.</summary>
    public void StartCapture()
    {
        if (_audioClient is null || _captureClient is null)
            throw new InvalidOperationException("Call InitializeAsync() first.");

        _capturing = true;

        int hr = _audioClient.Start();
        Marshal.ThrowExceptionForHR(hr);

        _captureThread = new Thread(CaptureLoop)
        {
            IsBackground = true,
            Name = "LoopbackCapture",
            Priority = ThreadPriority.AboveNormal
        };
        _captureThread.Start();
    }

    /// <summary>Stop capturing audio.</summary>
    public void StopCapture()
    {
        _capturing = false;
        try { _audioClient?.Stop(); } catch { /* best effort */ }
        _captureThread?.Join(2000);
    }

    private void CaptureLoop()
    {
        Exception? error = null;
        try
        {
            while (_capturing && !_ct.IsCancellationRequested)
            {
                Thread.Sleep(10); // ~10ms polling interval

                if (_captureClient is null || _captureFormat is null) break;

                int hr = _captureClient.GetNextPacketSize(out uint packetSize);
                if (hr < 0) break;

                while (packetSize > 0)
                {
                    hr = _captureClient.GetBuffer(
                        out IntPtr bufferPtr,
                        out uint numFrames,
                        out uint flags,
                        out _,
                        out _);

                    if (hr < 0) break;

                    int bytesPerFrame = _captureFormat.BlockAlign;
                    int byteCount = (int)numFrames * bytesPerFrame;

                    bool isSilent = (flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0;

                    if (byteCount > 0 && !isSilent)
                    {
                        byte[] buffer = new byte[byteCount];
                        Marshal.Copy(bufferPtr, buffer, 0, byteCount);
                        DataAvailable?.Invoke(buffer, _captureFormat);
                    }

                    hr = _captureClient.ReleaseBuffer(numFrames);
                    if (hr < 0) break;

                    hr = _captureClient.GetNextPacketSize(out packetSize);
                    if (hr < 0) break;
                }
            }
        }
        catch (Exception ex) when (!_ct.IsCancellationRequested)
        {
            error = ex;
        }
        finally
        {
            CaptureStopped?.Invoke(error);
        }
    }

    /// <summary>Parse a WAVEFORMATEX/WAVEFORMATEXTENSIBLE pointer into an NAudio WaveFormat.</summary>
    private static WaveFormat ParseWaveFormat(IntPtr ptr)
    {
        var wfx = Marshal.PtrToStructure<WAVEFORMATEX>(ptr);

        if (wfx.wFormatTag == WAVE_FORMAT_EXTENSIBLE && wfx.cbSize >= 22)
        {
            var wfxe = Marshal.PtrToStructure<WAVEFORMATEXTENSIBLE>(ptr);

            // Determine encoding from SubFormat GUID
            WaveFormatEncoding encoding;
            if (wfxe.SubFormat == KSDATAFORMAT_SUBTYPE_IEEE_FLOAT)
                encoding = WaveFormatEncoding.IeeeFloat;
            else if (wfxe.SubFormat == KSDATAFORMAT_SUBTYPE_PCM)
                encoding = WaveFormatEncoding.Pcm;
            else
                encoding = WaveFormatEncoding.IeeeFloat; // default assumption for WASAPI

            if (encoding == WaveFormatEncoding.IeeeFloat)
            {
                return WaveFormat.CreateIeeeFloatWaveFormat(
                    (int)wfx.nSamplesPerSec, wfx.nChannels);
            }
            else
            {
                return new WaveFormat(
                    (int)wfx.nSamplesPerSec, wfx.wBitsPerSample, wfx.nChannels);
            }
        }

        if (wfx.wFormatTag == WAVE_FORMAT_IEEE_FLOAT)
        {
            return WaveFormat.CreateIeeeFloatWaveFormat(
                (int)wfx.nSamplesPerSec, wfx.nChannels);
        }

        return new WaveFormat(
            (int)wfx.nSamplesPerSec, wfx.wBitsPerSample, wfx.nChannels);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        StopCapture();

        if (_waveFormatPtr != IntPtr.Zero)
        {
            Marshal.FreeCoTaskMem(_waveFormatPtr);
            _waveFormatPtr = IntPtr.Zero;
        }

        if (_activationParamsPtr != IntPtr.Zero)
        {
            Marshal.FreeHGlobal(_activationParamsPtr);
            _activationParamsPtr = IntPtr.Zero;
        }

        if (_blobPtr != IntPtr.Zero)
        {
            Marshal.FreeHGlobal(_blobPtr);
            _blobPtr = IntPtr.Zero;
        }

        if (_captureClient is not null)
        {
            Marshal.ReleaseComObject(_captureClient);
            _captureClient = null;
        }

        if (_audioClient is not null)
        {
            Marshal.ReleaseComObject(_audioClient);
            _audioClient = null;
        }
    }
}
