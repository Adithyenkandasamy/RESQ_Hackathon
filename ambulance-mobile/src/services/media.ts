import * as ImagePicker from 'expo-image-picker';

// Safely obtain Audio module without crashing if ExponentAV native module is missing in Expo Go.
// Cache the result so we only try once.
// IMPORTANT: We use string concatenation ('expo' + '-av') to prevent Metro from statically
// resolving this dependency at bundle time, which would cause it to throw during module evaluation.
let _audioModule: any = undefined; // undefined = not tried, null = unavailable
function getAudio() {
  if (_audioModule !== undefined) return _audioModule;
  try {
    // Defeat Metro static analysis so this is truly lazy
    const moduleName = 'expo' + '-av';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoAv = require(moduleName);
    // expo-av may load but throw when accessing Audio internals if native module is missing.
    // Probe it now to fail fast in this safe catch block.
    if (expoAv?.Audio?.requestPermissionsAsync) {
      _audioModule = expoAv.Audio;
    } else {
      _audioModule = null;
    }
  } catch {
    _audioModule = null;
  }
  return _audioModule;
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
    const Audio = getAudio();
    if (!Audio) {
      // In environments without ExponentAV (like Expo Go SDK 53+), grant mock permission
      return true;
    }
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  },

  async startAudioRecording(): Promise<boolean> {
    const Audio = getAudio();
    if (!Audio) {
      console.warn('Native ExponentAV module not found. Using simulated audio recording.');
      this.simulatedRecordingStartTime = Date.now();
      return true;
    }
    try {
      const granted = await this.requestMicrophonePermission();
      if (!granted) return false;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets?.HIGH_QUALITY || {}
      );
      this.recordingInstance = recording;
      return true;
    } catch (e) {
      console.warn('Failed to start audio recording:', e);
      return false;
    }
  },

  async stopAudioRecording(): Promise<AudioRecordingResult | null> {
    const Audio = getAudio();
    if (!Audio || this.simulatedRecordingStartTime) {
      const duration = this.simulatedRecordingStartTime
        ? Date.now() - this.simulatedRecordingStartTime
        : 3500;
      this.simulatedRecordingStartTime = null;
      return {
        uri: 'https://actions.google.com/sounds/v1/emergency/ambulance_siren_short.ogg',
        durationMs: Math.max(duration, 1000),
      };
    }

    try {
      if (!this.recordingInstance) return null;

      await this.recordingInstance.stopAndUnloadAsync();
      const uri = this.recordingInstance.getURI();
      const status = await this.recordingInstance.getStatusAsync();
      this.recordingInstance = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (!uri) return null;

      return {
        uri,
        durationMs: status.durationMillis || 0,
      };
    } catch (e) {
      console.warn('Failed to stop audio recording:', e);
      return null;
    }
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
