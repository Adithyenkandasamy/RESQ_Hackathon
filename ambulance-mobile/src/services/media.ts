import { NativeModules } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// Safely obtain Audio module without crashing if ExponentAV native module is missing in Expo Go.
// Cache the result so we only try once.
// Try expo-audio first (modern Expo Go SDK 52/53 module), fallback to expo-av
let _expoAudio: any = undefined;
function getExpoAudio() {
  if (_expoAudio !== undefined) return _expoAudio;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ea = require('expo-audio');
    if (ea && ea.AudioModule) {
      _expoAudio = ea;
      return _expoAudio;
    }
  } catch (err) {
    console.warn('expo-audio not available:', err);
  }
  _expoAudio = null;
  return null;
}

let _audioModule: any = undefined;
function getAudio() {
  if (_audioModule !== undefined) return _audioModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoAv = require('expo-av');
    if (expoAv?.Audio?.requestPermissionsAsync) {
      _audioModule = expoAv.Audio;
      return _audioModule;
    }
  } catch (err) {
    console.warn('Could not load expo-av:', err);
  }
  _audioModule = null;
  return null;
}

export interface CapturedImage {
  uri: string;
  base64?: string;
  width?: number;
  height?: number;
  fileName?: string;
  fileSize?: number;
}

export interface AudioRecordingResult {
  uri: string;
  durationMs: number;
}

export const MediaService = {
  // --- CAMERA & IMAGES ---
  async requestCameraPermission(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  async takePhoto(): Promise<CapturedImage | null> {
    try {
      const granted = await this.requestCameraPermission();
      if (!granted) return null;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          base64: asset.base64 || undefined,
          width: asset.width,
          height: asset.height,
          fileName: asset.fileName || 'scene_photo.jpg',
          fileSize: asset.fileSize,
        };
      }
      return null;
    } catch (e) {
      console.warn('Camera capture error:', e);
      return null;
    }
  },

  async pickImageFromLibrary(): Promise<CapturedImage | null> {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        return {
          uri: asset.uri,
          base64: asset.base64 || undefined,
          width: asset.width,
          height: asset.height,
          fileName: asset.fileName || 'scene_photo.jpg',
          fileSize: asset.fileSize,
        };
      }
      return null;
    } catch (e) {
      console.warn('Image picker error:', e);
      return null;
    }
  },

  // --- AUDIO RECORDING ---
  recordingInstance: null as any,
  soundInstance: null as any,
  simulatedRecordingStartTime: null as number | null,

  async requestMicrophonePermission(): Promise<boolean> {
    const ea = getExpoAudio();
    if (ea?.AudioModule?.requestRecordingPermissionsAsync) {
      try {
        const res = await ea.AudioModule.requestRecordingPermissionsAsync();
        if (res?.status === 'granted') return true;
      } catch (e) {
        console.warn('expo-audio permission error:', e);
      }
    }

    const Audio = getAudio();
    if (Audio?.requestPermissionsAsync) {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        return status === 'granted';
      } catch (e) {
        console.warn('expo-av permission error:', e);
      }
    }

    return false;
  },

  async startAudioRecording(): Promise<boolean> {
    const granted = await this.requestMicrophonePermission();
    if (!granted) {
      console.warn('Microphone permission not granted.');
      return false;
    }

    // 1. Try expo-audio (native module compiled into Expo Go SDK 52/53)
    const ea = getExpoAudio();
    if (ea?.AudioModule?.AudioRecorder) {
      try {
        const recorder = new ea.AudioModule.AudioRecorder(
          ea.RecordingPresets?.HIGH_QUALITY || {}
        );
        await recorder.prepareToRecordAsync();
        recorder.record();
        this.recordingInstance = { type: 'expo-audio', instance: recorder };
        return true;
      } catch (e) {
        console.warn('expo-audio record error:', e);
      }
    }

    // 2. Fallback to expo-av if present
    const Audio = getAudio();
    if (Audio?.Recording) {
      try {
        if (Audio.setAudioModeAsync) {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
          });
        }
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets?.HIGH_QUALITY || {}
        );
        this.recordingInstance = { type: 'expo-av', instance: recording };
        return true;
      } catch (e) {
        console.warn('expo-av record error:', e);
      }
    }

    console.warn('No native audio recorder available on this device.');
    return false;
  },

  async stopAudioRecording(): Promise<AudioRecordingResult | null> {
    if (!this.recordingInstance) {
      return null;
    }

    try {
      if (this.recordingInstance.type === 'expo-audio') {
        const recorder = this.recordingInstance.instance;
        this.recordingInstance = null;
        await recorder.stop();
        const uri = recorder.uri;
        const durationSec = recorder.currentTime || 0;
        if (!uri) return null;
        return {
          uri,
          durationMs: Math.max(Math.round(durationSec * 1000), 1000),
        };
      }

      if (this.recordingInstance.type === 'expo-av') {
        const recording = this.recordingInstance.instance;
        this.recordingInstance = null;
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        const status = await recording.getStatusAsync();
        const Audio = getAudio();
        if (Audio?.setAudioModeAsync) {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        }
        if (!uri) return null;
        return {
          uri,
          durationMs: status.durationMillis || 0,
        };
      }
    } catch (e) {
      console.warn('Failed to stop audio recording:', e);
      this.recordingInstance = null;
      return null;
    }

    return null;
  },

  async playAudio(uri: string, onFinish?: () => void): Promise<boolean> {
    const Audio = getAudio();
    if (!Audio) {
      if (onFinish) {
        setTimeout(onFinish, 2000);
      }
      return true;
    }

    try {
      if (this.soundInstance) {
        await this.soundInstance.unloadAsync();
        this.soundInstance = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (playbackStatus: any) => {
          if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
            if (onFinish) onFinish();
          }
        }
      );
      this.soundInstance = sound;
      return true;
    } catch (e) {
      console.warn('Failed to play audio:', e);
      return false;
    }
  },

  async stopAudioPlayback(): Promise<void> {
    const Audio = getAudio();
    if (!Audio) return;

    try {
      if (this.soundInstance) {
        await this.soundInstance.stopAsync();
        await this.soundInstance.unloadAsync();
        this.soundInstance = null;
      }
    } catch (e) {
      console.warn('Failed to stop sound:', e);
    }
  },
};
