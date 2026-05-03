import { useState, useRef, useCallback, useEffect } from "react";

// Helper để tạo file WAV từ mảng PCM (Float32Array)
const exportWAV = (
  audioData: Float32Array[],
  totalLength: number,
  sampleRate: number
): Blob => {
  const buffer = new ArrayBuffer(44 + totalLength * 2);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + totalLength * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Format (PCM)
  view.setUint16(22, 1, true); // Channels (1)
  view.setUint32(24, sampleRate, true); // Sample Rate
  view.setUint32(28, sampleRate * 2, true); // Byte Rate
  view.setUint16(32, 2, true); // Block Align
  view.setUint16(34, 16, true); // Bits Per Sample
  writeString(view, 36, "data");
  view.setUint32(40, totalLength * 2, true);

  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const chunk = audioData[i];
    for (let j = 0; j < chunk.length; j++, offset += 2) {
      let s = Math.max(-1, Math.min(1, chunk[j]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }

  return new Blob([view], { type: "audio/wav" });
};

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const pcmDataRef = useRef<Float32Array[]>([]);
  const totalLengthRef = useRef(0);
  const isRecordingRef = useRef(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      cleanup();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContext();
      
      const source = context.createMediaStreamSource(stream);
      // Sử dụng 4096 buffer size, 1 kênh input, 1 kênh output
      const processor = context.createScriptProcessor(4096, 1, 1);

      audioContextRef.current = context;
      streamRef.current = stream;
      sourceRef.current = source;
      processorRef.current = processor;

      pcmDataRef.current = [];
      totalLengthRef.current = 0;
      isRecordingRef.current = true;
      setAudioBlob(null);
      setRecordingTime(0);

      processor.onaudioprocess = (e) => {
        if (!isRecordingRef.current) return;
        const channelData = e.inputBuffer.getChannelData(0);
        // Copy data to avoid mutation
        pcmDataRef.current.push(new Float32Array(channelData));
        totalLengthRef.current += channelData.length;
      };

      // Dummy destination kết nối để processor chạy (bắt buộc trên Chrome)
      source.connect(processor);
      processor.connect(context.destination);

      setIsRecording(true);
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }, [cleanup]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    if (audioContextRef.current) {
      const sampleRate = audioContextRef.current.sampleRate;
      const wavBlob = exportWAV(pcmDataRef.current, totalLengthRef.current, sampleRate);
      setAudioBlob(wavBlob);
    }

    setIsRecording(false);
    cleanup();
  }, [cleanup]);

  const cancelRecording = useCallback(() => {
    isRecordingRef.current = false;
    setAudioBlob(null);
    setRecordingTime(0);
    setIsRecording(false);
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    audioBlob,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
    setAudioBlob,
  };
};
