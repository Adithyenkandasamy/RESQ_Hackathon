import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEmergency } from '../../context/EmergencyContext';
import { LocationService } from '../../services/location';
import { MediaService, CapturedImage } from '../../services/media';
import { AppInput } from '../../components/AppInput';
import { AppButton } from '../../components/AppButton';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius, Shadows } from '../../constants/spacing';
import { Typography } from '../../constants/typography';
import {
  MapPin,
  RefreshCw,
  X,
  HeartPulse,
  Camera,
  ImageIcon,
  Mic,
  Square,
  Activity,
  Trash2,
} from 'lucide-react-native';

export default function CreateEmergencyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createEmergency } = useEmergency();

  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Read cached GPS from continuous tracking service
  const initialLoc = LocationService.getCachedLocation();

  // 1. Single Clinical Narrative (Chat / Text or Voice)
  const [patientCondition, setPatientCondition] = useState('');

  // 2. Patient / Scene Photo
  const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(null);

  // 3. Voice Dictation State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordTimer, setRecordTimer] = useState<any>(null);

  // 4. GPS & Scene Location
  const [ambulanceLat, setAmbulanceLat] = useState<number | null>(initialLoc?.latitude ?? null);
  const [ambulanceLng, setAmbulanceLng] = useState<number | null>(initialLoc?.longitude ?? null);
  const [incidentAtAmbulanceLocation, setIncidentAtAmbulanceLocation] = useState(true);
  const [sceneAddress, setSceneAddress] = useState('');
  const [sceneLat, setSceneLat] = useState<number | null>(initialLoc?.latitude ?? null);
  const [sceneLng, setSceneLng] = useState<number | null>(initialLoc?.longitude ?? null);
  const [locationLabel, setLocationLabel] = useState(
    initialLoc
      ? `${initialLoc.latitude.toFixed(4)}, ${initialLoc.longitude.toFixed(4)}`
      : 'Acquiring GPS...'
  );

  useEffect(() => {
    fetchCurrentGPS();
  }, []);

  const fetchCurrentGPS = async () => {
    setGpsLoading(true);
    try {
      const loc = await LocationService.getCurrentLocation();
      if (loc && LocationService.isValidCoordinate(loc.latitude, loc.longitude)) {
        setAmbulanceLat(loc.latitude);
        setAmbulanceLng(loc.longitude);
        if (incidentAtAmbulanceLocation) {
          setSceneLat(loc.latitude);
          setSceneLng(loc.longitude);
          setLocationLabel(`${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`);
        }
      } else {
        setLocationLabel('GPS signal unavailable');
      }
    } catch {
      setLocationLabel('GPS signal unavailable');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleToggleSceneLocation = (atAmbulance: boolean) => {
    setIncidentAtAmbulanceLocation(atAmbulance);
    if (atAmbulance) {
      setSceneLat(ambulanceLat);
      setSceneLng(ambulanceLng);
    } else {
      setSceneLat(null);
      setSceneLng(null);
    }
  };

  // Camera capture
  const handleTakePhoto = async () => {
    try {
      const photo = await MediaService.takePhoto();
      if (photo) {
        setCapturedImage(photo);
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e.message || 'Could not take photo.');
    }
  };

  // Gallery picker
  const handlePickImage = async () => {
    try {
      const photo = await MediaService.pickImageFromLibrary();
      if (photo) {
        setCapturedImage(photo);
      }
    } catch (e: any) {
      Alert.alert('Photo Picker Error', e.message || 'Could not access photo library.');
    }
  };

  // Voice recording & dictation
  const startVoiceDictation = async () => {
    const started = await MediaService.startAudioRecording();
    if (started) {
      setIsRecording(true);
      setRecordDuration(0);
      const timer = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
      setRecordTimer(timer);
    } else {
      Alert.alert('Microphone Error', 'Could not access microphone.');
    }
  };

  const stopVoiceDictation = async () => {
    if (recordTimer) {
      clearInterval(recordTimer);
      setRecordTimer(null);
    }
    setIsRecording(false);
    setIsTranscribing(true);

    try {
      const audioResult = await MediaService.stopAudioRecording();
      if (audioResult) {
        // Append voice note indicator into text
        const voiceTag = `[Voice Note (${recordDuration}s recorded)]`;
        setPatientCondition((prev) => (prev ? `${prev}\n${voiceTag}` : voiceTag));
      }
    } catch (e: any) {
      Alert.alert('Audio Error', e.message || 'Could not process audio.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleDispatch = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const finalLat = incidentAtAmbulanceLocation ? sceneLat : sceneLat;
      const finalLng = incidentAtAmbulanceLocation ? sceneLng : sceneLng;
      const sceneDesc = incidentAtAmbulanceLocation
        ? (sceneAddress.trim() ? `${sceneAddress.trim()} (at unit GPS)` : `Scene @ ${locationLabel}`)
        : (sceneAddress.trim() || 'Field Emergency Scene');

      const narrative = patientCondition.trim() || 'Immediate patient triage intake';

      // Build patient info with single narrative and attached photo
      const patientInfo: Record<string, any> = {
        condition_description: narrative,
      };

      if (capturedImage?.base64) {
        const dataUrl = `data:image/jpeg;base64,${capturedImage.base64}`;
        patientInfo.image_url = dataUrl;
        patientInfo.images = [dataUrl];
      } else if (capturedImage?.uri) {
        patientInfo.image_url = capturedImage.uri;
        patientInfo.images = [capturedImage.uri];
      }

      await createEmergency({
        incident_type: 'EMERGENCY',
        location_description: narrative,
        incident_latitude: finalLat ?? undefined,
        incident_longitude: finalLng ?? undefined,
        required_capabilities: ['trauma_center', 'icu'],
        patient_info: patientInfo,
      });

      router.replace('/emergency/active');
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('cancel') || msg.includes('abort') || err?.status === 499) {
        router.replace('/emergency/active');
        return;
      }
      Alert.alert('Dispatch Failed', err.message || 'Could not dispatch emergency to backend.');
    } finally {
      setLoading(false);
    }
  };

  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? 24 : 0);
  const safeBottom = Math.max(insets.bottom, Spacing.base);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.fixedScreen}
    >
      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: safeTop + 10 }]}>
        <View>
          <Text style={styles.screenTitle}>Rapid Emergency Dispatch</Text>
          <Text style={styles.screenSubtitle}>Pass condition & photo — save life immediately</Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={20} color={Colors.secondaryText} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        {/* Incident Scene Location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>INCIDENT LOCATION</Text>
          <View style={styles.locationToggleRow}>
            <TouchableOpacity
              style={[
                styles.locToggleBtn,
                incidentAtAmbulanceLocation && styles.locToggleBtnActive,
              ]}
              onPress={() => handleToggleSceneLocation(true)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.locToggleText,
                  incidentAtAmbulanceLocation && styles.locToggleTextActive,
                ]}
              >
                At Unit Position
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.locToggleBtn,
                !incidentAtAmbulanceLocation && styles.locToggleBtnActive,
              ]}
              onPress={() => handleToggleSceneLocation(false)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.locToggleText,
                  !incidentAtAmbulanceLocation && styles.locToggleTextActive,
                ]}
              >
                Different Area / Landmark
              </Text>
            </TouchableOpacity>
          </View>

          {incidentAtAmbulanceLocation ? (
            <View style={styles.gpsBar}>
              <View style={styles.gpsLeft}>
                <MapPin size={16} color={Colors.primaryBlue} />
                <Text style={styles.gpsText} numberOfLines={1}>
                  Unit GPS: {locationLabel}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.gpsRefreshBtn}
                onPress={fetchCurrentGPS}
                disabled={gpsLoading}
              >
                <RefreshCw size={14} color={Colors.primaryBlue} />
                <Text style={styles.gpsRefreshText}>{gpsLoading ? 'Locating...' : 'Refresh'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ marginTop: Spacing.xs }}>
              <AppInput
                placeholder="Enter area, junction, or landmark..."
                value={sceneAddress}
                onChangeText={setSceneAddress}
                style={styles.inputField}
              />
            </View>
          )}
        </View>

        {/* ── Core Patient Condition Narrative (Chat & Voice) ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Activity size={16} color={Colors.primaryBlue} />
              <Text style={styles.sectionLabel}>PATIENT CONDITION & INTAKE DETAILS</Text>
            </View>
            <View style={styles.realtimeBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.realtimeText}>TRANSMITS TO HOSPITALS</Text>
            </View>
          </View>
          <Text style={styles.helperText}>
            Type patient condition, name or area if known, or speak hands-free. No complex forms required.
          </Text>

          <TextInput
            style={styles.narrativeInput}
            multiline
            numberOfLines={4}
            placeholder="e.g. Male approx 35, accident near Anna Nagar junction. Severe head trauma, bleeding, unconscious, breathing fast. Urgent trauma ICU needed..."
            placeholderTextColor={Colors.secondaryText}
            value={patientCondition}
            onChangeText={setPatientCondition}
          />

          {/* Voice Dictation Bar */}
          <View style={styles.voiceBar}>
            {isRecording ? (
              <TouchableOpacity
                style={styles.recordingBtn}
                onPress={stopVoiceDictation}
                activeOpacity={0.8}
              >
                <Square size={16} color="#FFFFFF" />
                <Text style={styles.recordingBtnText}>
                  Stop Dictation ({recordDuration}s)
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.dictateBtn}
                onPress={startVoiceDictation}
                disabled={isTranscribing}
                activeOpacity={0.8}
              >
                <Mic size={16} color={Colors.primaryBlue} />
                <Text style={styles.dictateBtnText}>
                  {isTranscribing ? 'Processing...' : 'Speak / Record Voice'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Patient / Scene Photo Attachment ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PATIENT / SCENE PHOTO</Text>
          <Text style={styles.helperText}>
            Attach image of patient condition or trauma scene for receiving emergency doctors.
          </Text>

          {capturedImage ? (
            <View style={styles.imagePreviewBox}>
              <Image source={{ uri: capturedImage.uri }} style={styles.imageThumbnail} />
              <View style={styles.imageDetails}>
                <Text style={styles.imageSuccessText}>✓ Image Attached</Text>
                <Text style={styles.imageSubtext}>Will be transmitted live to hospital triage bay</Text>
              </View>
              <TouchableOpacity
                style={styles.deletePhotoBtn}
                onPress={() => setCapturedImage(null)}
              >
                <Trash2 size={16} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoActionsRow}>
              <TouchableOpacity
                style={styles.photoActionBtn}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
              >
                <Camera size={18} color={Colors.primaryBlue} />
                <Text style={styles.photoActionText}>Take Camera Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photoActionBtn}
                onPress={handlePickImage}
                activeOpacity={0.8}
              >
                <ImageIcon size={18} color={Colors.primaryBlue} />
                <Text style={styles.photoActionText}>Pick from Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Pinned Bottom Dispatch Action */}
      <View style={[styles.bottomBar, { paddingBottom: safeBottom }]}>
        <AppButton
          title={loading ? 'DISPATCHING TO HOSPITALS...' : 'DISPATCH EMERGENCY NOW'}
          onPress={handleDispatch}
          loading={loading}
          variant="emergency"
          icon={<HeartPulse size={22} color="#FFFFFF" />}
          style={styles.dispatchButton}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fixedScreen: {
    flex: 1,
    backgroundColor: Colors.mainBackground,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borders,
  },
  screenTitle: {
    ...Typography.h2,
    fontSize: 18,
    color: Colors.darkNavy,
  },
  screenSubtitle: {
    ...Typography.caption,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  closeBtn: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.mainBackground,
  },
  contentContainer: {
    padding: Spacing.base,
    paddingBottom: 40,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionLabel: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.secondaryText,
    letterSpacing: 0.5,
  },
  helperText: {
    ...Typography.caption,
    color: Colors.secondaryText,
    marginBottom: Spacing.sm,
  },
  realtimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  realtimeText: {
    ...Typography.caption,
    fontSize: 9,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  narrativeInput: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    padding: Spacing.md,
    ...Typography.body,
    fontSize: 14,
    color: Colors.primaryText,
    minHeight: 110,
    textAlignVertical: 'top',
    ...Shadows.card,
  },
  voiceBar: {
    marginTop: Spacing.sm,
  },
  dictateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.lightBlue,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    gap: 6,
  },
  dictateBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.primaryBlue,
  },
  recordingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.error,
    gap: 6,
  },
  recordingBtnText: {
    ...Typography.caption,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1.5,
    borderColor: Colors.borders,
    gap: 8,
    ...Shadows.card,
  },
  photoActionText: {
    ...Typography.caption,
    fontWeight: '700',
    color: Colors.primaryBlue,
  },
  imagePreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.medicalGreen,
  },
  imageThumbnail: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.borders,
  },
  imageDetails: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  imageSuccessText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.medicalGreen,
  },
  imageSubtext: {
    ...Typography.caption,
    color: Colors.secondaryText,
    marginTop: 2,
  },
  deletePhotoBtn: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FEF2F2',
  },
  locationToggleRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  locToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.borders,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locToggleBtnActive: {
    borderColor: Colors.primaryBlue,
    backgroundColor: Colors.lightBlue,
  },
  locToggleText: {
    ...Typography.caption,
    color: Colors.secondaryText,
    fontWeight: '600',
  },
  locToggleTextActive: {
    color: Colors.primaryBlue,
    fontWeight: '700',
  },
  gpsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.lightBlue,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.2)',
  },
  gpsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  gpsText: {
    ...Typography.bodySmall,
    color: Colors.primaryBlue,
    fontWeight: '600',
    marginLeft: Spacing.xs,
    flex: 1,
  },
  gpsRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs,
  },
  gpsRefreshText: {
    ...Typography.caption,
    color: Colors.primaryBlue,
    fontWeight: '700',
    marginLeft: 4,
  },
  inputField: {
    marginTop: Spacing.xs,
  },
  bottomBar: {
    padding: Spacing.base,
    backgroundColor: Colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: Colors.borders,
    ...Shadows.card,
  },
  dispatchButton: {
    height: 52,
    borderRadius: BorderRadius.md,
  },
});
