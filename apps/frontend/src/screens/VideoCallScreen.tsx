/**
 * Video Call Screen
 *
 * Handles video consultation with healthcare providers
 * SPEC-004: Telemedicine Integration Module
 *
 * NOTE: This is a placeholder implementation for video call functionality.
 * In production, integrate with Agora, Twilio, or Daily.co SDKs.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TelemedicineVideoCall'>;

type CallState = 'connecting' | 'connected' | 'ended' | 'error';

export const VideoCallScreen: React.FC<Props> = ({ route, navigation }) => {
  const { appointmentId } = route.params;
  const [callState, setCallState] = useState<CallState>('connecting');
  const [duration, setDuration] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Simulate call connection
    startCall();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startCall = async () => {
    try {
      // In production, initialize video SDK here
      // await agoraService.joinChannel({ appointmentId });

      // Simulate connection delay
      setTimeout(() => {
        setCallState('connected');
        startTimer();
      }, 2000);
    } catch (error) {
      setCallState('error');
      Alert.alert('Error', 'Failed to connect to video call');
    }
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const endCall = async () => {
    try {
      // In production, properly end video call
      // await appointmentService.endVideoCall(appointmentId);
      setCallState('ended');

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      Alert.alert(
        'Call Ended',
        `Duration: ${formatDuration(duration)}`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to end call properly');
    }
  };

  const toggleMic = () => {
    // In production: await agoraService.toggleMicrophone();
    setMicEnabled(!micEnabled);
  };

  const toggleCamera = () => {
    // In production: await agoraService.toggleCamera();
    setCameraEnabled(!cameraEnabled);
  };

  const toggleSpeaker = () => {
    // In production: await agoraService.toggleSpeaker();
    setSpeakerEnabled(!speakerEnabled);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderConnectingState = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.connectingText}>Connecting to consultation...</Text>
    </View>
  );

  const renderConnectedState = () => (
    <View style={styles.videoContainer}>
      {/* Remote Video (Provider) */}
      <View style={styles.remoteVideo}>
        <View style={styles.videoPlaceholder}>
          <Text style={styles.videoPlaceholderText}>Dr. Maria Garcia</Text>
          <Text style={styles.videoPlaceholderSubtext}>Cardiologist</Text>
        </View>

        {/* Call Info Overlay */}
        <View style={styles.callInfo}>
          <View style={[styles.recordingIndicator, { backgroundColor: '#EF4444' }]}>
            <Text style={styles.recordingText}>● REC</Text>
          </View>
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
        </View>
      </View>

      {/* Local Video (Patient) - Picture in Picture */}
      <View style={styles.localVideo}>
        <View style={styles.videoPlaceholderMini}>
          {!cameraEnabled ? (
            <Text style={styles.videoOffText}>Camera Off</Text>
          ) : (
            <Text style={styles.videoPlaceholderTextMini}>You</Text>
          )}
        </View>
      </View>

      {/* Controls */}
      {showControls && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleMic}>
            <View style={[styles.controlIcon, micEnabled ? styles.controlIconActive : styles.controlIconInactive]}>
              <Text style={styles.controlButtonText}>{micEnabled ? '🎤' : '🔇'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
            <View style={[styles.controlIcon, cameraEnabled ? styles.controlIconActive : styles.controlIconInactive]}>
              <Text style={styles.controlButtonText}>{cameraEnabled ? '📹' : '📷'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={toggleSpeaker}>
            <View style={[styles.controlIcon, speakerEnabled ? styles.controlIconActive : styles.controlIconInactive]}>
              <Text style={styles.controlButtonText}>{speakerEnabled ? '🔊' : '📱'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.controlButton, styles.endCallButton]} onPress={endCall}>
            <View style={styles.endCallIcon}>
              <Text style={styles.endCallText}>📞</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Health Summary Button */}
      <TouchableOpacity
        style={styles.healthSummaryButton}
        onPress={() => {
          setShowControls(false);
          // In production, show health summary modal
          Alert.alert('Health Summary', 'Your health summary is being shared with the provider.');
        }}
      >
        <Text style={styles.healthSummaryButtonText}>📊 Health Summary</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEndedState = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.endedText}>Call Ended</Text>
      <Text style={styles.endedSubtext}>Duration: {formatDuration(duration)}</Text>
      <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.errorTitle}>Connection Error</Text>
      <Text style={styles.errorText}>Failed to connect to the video call</Text>
      <TouchableOpacity style={styles.retryButton} onPress={startCall}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
        <Text style={styles.closeButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {callState === 'connecting' && renderConnectingState()}
      {callState === 'connected' && renderConnectedState()}
      {callState === 'ended' && renderEndedState()}
      {callState === 'error' && renderErrorState()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  connectingText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 16,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    alignItems: 'center',
  },
  videoPlaceholderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  videoPlaceholderSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  callInfo: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordingIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recordingText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  durationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  localVideo: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#374151',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  videoPlaceholderMini: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOffText: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  videoPlaceholderTextMini: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  controls: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#374151',
  },
  controlIconActive: {
    backgroundColor: '#FFFFFF',
  },
  controlIconInactive: {
    backgroundColor: '#EF4444',
  },
  controlButtonText: {
    fontSize: 24,
  },
  endCallButton: {
    marginLeft: 16,
  },
  endCallIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallText: {
    fontSize: 28,
  },
  healthSummaryButton: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  healthSummaryButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  endedText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  endedSubtext: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
