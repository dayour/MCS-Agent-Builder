using NAudio.Wave;

namespace AudioCapture;

/// <summary>
/// Resamples audio from any input format (typically 48kHz/32-bit float stereo)
/// to 16kHz/16-bit/mono PCM. This is the standard format for speech processing
/// and the format we send over the WebSocket.
/// </summary>
public sealed class Resampler : IDisposable
{
    /// <summary>Target output format: 16kHz, 16-bit, mono PCM.</summary>
    public static readonly WaveFormat TargetFormat = new(16000, 16, 1);

    private readonly object _lock = new();
    private bool _disposed;

    /// <summary>
    /// Resample a buffer from the source format to 16kHz/16-bit/mono PCM.
    /// This performs the conversion in a single pass:
    ///   1. Decode source bytes to float samples
    ///   2. Mix down to mono if stereo/multi-channel
    ///   3. Resample from source rate to 16kHz using linear interpolation
    ///   4. Convert float samples to 16-bit PCM bytes
    /// </summary>
    public byte[] Process(byte[] input, WaveFormat sourceFormat)
    {
        if (input.Length == 0) return Array.Empty<byte>();

        lock (_lock)
        {
            // Step 1: Convert input bytes to float samples (interleaved if multi-channel)
            float[] samples = DecodeToFloat(input, sourceFormat);
            if (samples.Length == 0) return Array.Empty<byte>();

            // Step 2: Mix down to mono
            float[] mono = MixToMono(samples, sourceFormat.Channels);

            // Step 3: Resample to 16kHz
            float[] resampled = ResampleLinear(mono, sourceFormat.SampleRate, TargetFormat.SampleRate);

            // Step 4: Convert to 16-bit PCM bytes
            return FloatToPcm16(resampled);
        }
    }

    /// <summary>Decode raw bytes to float samples based on the source wave format.</summary>
    private static float[] DecodeToFloat(byte[] data, WaveFormat format)
    {
        int bytesPerSample = format.BitsPerSample / 8;
        int totalSamples = data.Length / bytesPerSample;

        if (totalSamples == 0) return Array.Empty<float>();

        float[] result = new float[totalSamples];

        // Handle IEEE float (32-bit float, common for WASAPI shared mode)
        if (format.Encoding == WaveFormatEncoding.IeeeFloat ||
            (format.Encoding == WaveFormatEncoding.Extensible && format.BitsPerSample == 32))
        {
            for (int i = 0; i < totalSamples; i++)
            {
                int offset = i * 4;
                if (offset + 4 <= data.Length)
                    result[i] = BitConverter.ToSingle(data, offset);
            }
        }
        // Handle 16-bit PCM
        else if (format.BitsPerSample == 16)
        {
            for (int i = 0; i < totalSamples; i++)
            {
                int offset = i * 2;
                if (offset + 2 <= data.Length)
                    result[i] = BitConverter.ToInt16(data, offset) / 32768f;
            }
        }
        // Handle 24-bit PCM
        else if (format.BitsPerSample == 24)
        {
            for (int i = 0; i < totalSamples; i++)
            {
                int offset = i * 3;
                if (offset + 3 <= data.Length)
                {
                    int sample = (data[offset]) | (data[offset + 1] << 8) | (data[offset + 2] << 16);
                    // Sign-extend from 24 bits
                    if ((sample & 0x800000) != 0) sample |= unchecked((int)0xFF000000);
                    result[i] = sample / 8388608f;
                }
            }
        }
        // Handle 32-bit PCM (integer)
        else if (format.BitsPerSample == 32 && format.Encoding == WaveFormatEncoding.Pcm)
        {
            for (int i = 0; i < totalSamples; i++)
            {
                int offset = i * 4;
                if (offset + 4 <= data.Length)
                    result[i] = BitConverter.ToInt32(data, offset) / 2147483648f;
            }
        }
        else
        {
            throw new NotSupportedException(
                $"Unsupported audio format: {format.Encoding}, {format.BitsPerSample}-bit");
        }

        return result;
    }

    /// <summary>Mix interleaved multi-channel samples down to mono by averaging channels.</summary>
    private static float[] MixToMono(float[] interleaved, int channels)
    {
        if (channels == 1) return interleaved;

        int frameCount = interleaved.Length / channels;
        float[] mono = new float[frameCount];

        for (int i = 0; i < frameCount; i++)
        {
            float sum = 0f;
            for (int ch = 0; ch < channels; ch++)
            {
                sum += interleaved[i * channels + ch];
            }
            mono[i] = sum / channels;
        }

        return mono;
    }

    /// <summary>
    /// Resample using linear interpolation. Good enough for speech audio
    /// where we're going from 48kHz to 16kHz (3:1 decimation).
    /// </summary>
    private static float[] ResampleLinear(float[] source, int sourceRate, int targetRate)
    {
        if (sourceRate == targetRate) return source;

        double ratio = (double)sourceRate / targetRate;
        int outputLength = (int)(source.Length / ratio);
        if (outputLength == 0) return Array.Empty<float>();

        float[] result = new float[outputLength];

        for (int i = 0; i < outputLength; i++)
        {
            double srcIndex = i * ratio;
            int idx = (int)srcIndex;
            double frac = srcIndex - idx;

            if (idx + 1 < source.Length)
                result[i] = (float)(source[idx] * (1.0 - frac) + source[idx + 1] * frac);
            else if (idx < source.Length)
                result[i] = source[idx];
        }

        return result;
    }

    /// <summary>Convert float samples [-1.0, 1.0] to 16-bit PCM byte array.</summary>
    private static byte[] FloatToPcm16(float[] samples)
    {
        byte[] result = new byte[samples.Length * 2];
        for (int i = 0; i < samples.Length; i++)
        {
            // Clamp to [-1, 1] then convert
            float clamped = Math.Max(-1f, Math.Min(1f, samples[i]));
            short pcm = (short)(clamped * 32767f);
            result[i * 2] = (byte)(pcm & 0xFF);
            result[i * 2 + 1] = (byte)((pcm >> 8) & 0xFF);
        }
        return result;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
    }
}
