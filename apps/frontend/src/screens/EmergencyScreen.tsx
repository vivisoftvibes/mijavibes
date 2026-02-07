/**
 * Emergency Screen
 *
 * SPEC-003: Emergency Alerts System
 *
 * Features:
 * - SOS button for immediate emergency notification (EA-006)
 * - Active alerts display with acknowledgment (EA-005)
 * - Alert status tracking with escalation information (EA-003)
 * - Location sharing for emergencies (EA-004)
 * - Quick access to emergency contacts
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert as AlertModal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { emergencyService } from '../services/api';
import {
  EmergencyAlert,
  EmergencyContact,
} from '../types';
import type { RouteProp } from '@react-navigation/native';

interface Props {
  route?: RouteProp<
    { Emergency: { alertId?: string } },
    'Emergency'
  >;
}

type AlertState = 'idle' | 'triggering' | 'active' | 'acknowledged' | 'resolved';

export const EmergencyScreen: React.FC<Props> = ({ route }) => {
  const [alertState, setAlertState] = useState<AlertState>('idle');
  const [activeAlerts, setActiveAlerts] = useState<EmergencyAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<EmergencyAlert | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
    address?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [escalationTimer, setEscalationTimer] = useState<number>(0);

  // Load active alerts on screen focus
  useFocusEffect(
    useCallback(() => {
      loadActiveAlerts();
      loadEmergencyContacts();

      // Check if specific alert was passed in route params
      if (route?.params?.alertId) {
        loadAlertDetails(route.params.alertId);
      }

      // Set up escalation timer
      const timer = setInterval(() => {
        setEscalationTimer((prev) => (prev >= 600 ? 600 : prev + 1)); // Cap at 10 minutes
      }, 1000);

      return () => clearInterval(timer);
    }, [route?.params?.alertId])
  );

  const loadActiveAlerts = async () => {
    try {
      const response = await emergencyService.getAlerts('active', 10);
      setActiveAlerts(response);
      if (response.length > 0) {
        setAlertState('active');
        setSelectedAlert(response[0]);
      }
    } catch (error) {
      console.error('Failed to load active alerts:', error);
    }
  };

  const loadAlertDetails = async (alertId: string) => {
    try {
      const alert = await emergencyService.getAlert(alertId);
      setSelectedAlert(alert);
      setAlertState(alert.status === 'active' ? 'active' : 'acknowledged');
    } catch (error) {
      console.error('Failed to load alert details:', error);
    }
  };

  const loadEmergencyContacts = async () => {
    try {
      const response = await emergencyService.getContacts();
      setContacts(response);
    } catch (error) {
      console.error('Failed to load emergency contacts:', error);
    }
  };

  const getCurrentLocation = async (): Promise<{
    lat: number;
    lng: number;
    address?: string;
  } | null> => {
    setIsLoadingLocation(true);

    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        AlertModal.alert(
          'Location Permission Required',
          'Please enable location services to share your location in case of emergency.',
          [{ text: 'OK' }]
        );
        setIsLoadingLocation(false);
        return null;
      }

      // Get current location
      const locationData = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = locationData.coords;

      // Reverse geocode to get address (optional)
      let address: string | undefined;
      try {
        const geocode = await Location.reverseGeocodeAsync(
          { latitude, longitude }
        );
        if (geocode.length > 0) {
          const { street, city, region, postalCode } = geocode[0];
          address = [
            street,
            city,
            region,
            postalCode,
          ].filter(Boolean).join(', ');
        }
      } catch (geocodeError) {
        console.warn('Failed to reverse geocode:', geocodeError);
      }

      const locationResult = {
        lat: latitude,
        lng: longitude,
        address,
      };

      setLocation(locationResult);
      setIsLoadingLocation(false);
      return locationResult;
    } catch (error) {
      console.error('Failed to get location:', error);
      setIsLoadingLocation(false);

      AlertModal.alert(
        'Location Error',
        'Failed to get your current location. Emergency will be sent without location.',
        [{ text: 'OK' }]
      );

      return null;
    }
  };

  const triggerSOS = async () => {
    // Confirmation dialog
    AlertModal.alert(
      'Trigger Emergency SOS?',
      'This will immediately notify ALL your emergency contacts and may contact emergency services with your location.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'TRIGGER SOS',
          style: 'destructive',
          onPress: async () => {
            setAlertState('triggering');
            setIsLoading(true);

            // Get current location for emergency services
            const currentLocation = await getCurrentLocation();

            try {
              const alert = await emergencyService.createAlert({
                type: 'manual_trigger',
                location: currentLocation || undefined,
                notes: 'SOS button triggered by user',
                bypassEscalation: true,
              });

              setSelectedAlert(alert);
              setAlertState('active');
              setActiveAlerts([alert, ...activeAlerts]);

              // Success feedback
              if (Platform.OS === 'ios' || Platform.OS === 'android') {
                // Vibrate for haptic feedback
                // Note: Vibration API would be here
              }

              AlertModal.alert(
                'SOS Triggered',
                'Emergency contacts have been notified. Stay calm, help is on the way.',
                [{ text: 'I Understand' }]
              );
            } catch (error) {
              console.error('Failed to trigger SOS:', error);
              setAlertState('idle');
              AlertModal.alert(
                'Error',
                'Failed to trigger emergency alert. Please try again or call emergency services directly.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const acknowledgeAlert = async () => {
    if (!selectedAlert) return;

    setIsLoading(true);

    try {
      const updatedAlert = await emergencyService.acknowledgeAlert(
        selectedAlert.id,
        'User acknowledged via app'
      );

      setSelectedAlert(updatedAlert);
      setAlertState('acknowledged');

      // Remove from active alerts
      setActiveAlerts((prev) =>
        prev.filter((a) => a.id !== selectedAlert.id)
      );

      AlertModal.alert(
        'Alert Acknowledged',
        'Your contacts have been notified that you are responding.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      AlertModal.alert(
        'Error',
        'Failed to acknowledge alert. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resolveAlert = async () => {
    if (!selectedAlert) return;

    AlertModal.alert(
      'Resolve Alert?',
      'Mark this emergency as resolved? This will notify all contacts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            setIsLoading(true);

            try {
              const updatedAlert = await emergencyService.resolveAlert(
                selectedAlert.id,
                'User resolved via app',
                false
              );

              setSelectedAlert(updatedAlert);
              setAlertState('resolved');

              // Remove from active alerts
              setActiveAlerts((prev) =>
                prev.filter((a) => a.id !== selectedAlert.id)
              );

              AlertModal.alert(
                'Alert Resolved',
                'Your contacts have been notified that the situation is resolved.',
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Failed to resolve alert:', error);
              AlertModal.alert(
                'Error',
                'Failed to resolve alert. Please try again.',
                [{ text: 'OK' }]
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const callEmergencyServices = () => {
    AlertModal.alert(
      'Call Emergency Services?',
      'Do you want to call 911 (or your local emergency number)?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call 911',
          style: 'destructive',
          onPress: () => {
            // In a real app, this would trigger a phone call
            // For now, show an alert
            AlertModal.alert(
              'Dialing...',
              'In a production app, this would dial 911.',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
  };

  const formatAlertType = (type: string): string => {
    const typeMap: Record<string, string> = {
      critical_bp: 'Critical Blood Pressure',
      critical_glucose: 'Critical Glucose',
      medication_missed: 'Medication Missed',
      no_response: 'No Response',
      manual_trigger: 'SOS Emergency',
      irregular_pattern: 'Abnormal Pattern',
    };
    return typeMap[type] || type;
  };

  const formatEscalationLevel = (level: number): string => {
    if (level === 0) return 'Primary Contacts Notified';
    if (level === 1) return 'Escalated to Secondary Contacts';
    return 'Escalated to Emergency Services';
  };

  const getSeverityColor = (severity?: string): string => {
    switch (severity) {
      case 'critical':
        return '#DC2626';
      case 'high':
        return '#F59E0B';
      case 'warning':
        return '#FBBF24';
      default:
        return '#6B7280';
    }
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const formatEscalationTime = (level: number): string => {
    if (level === 0) return `5m until escalation`;
    if (level === 1) return `5m until emergency services`;
    return 'Emergency services notified';
  };

  // Render active alert card
  const renderActiveAlert = () => {
    if (!selectedAlert) return null;

    return (
      <View style={styles.alertCard}>
        <View style={[styles.alertHeader, { backgroundColor: getSeverityColor(selectedAlert.severity) }]}>
          <Text style={styles.alertTitle}>{formatAlertType(selectedAlert.type)}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {selectedAlert.escalationLevel === 0 ? 'ACTIVE' : 'ESCALATED'}
            </Text>
          </View>
        </View>

        <View style={styles.alertBody}>
          <View style={styles.alertInfo}>
            <Text style={styles.alertLabel}>Triggered</Text>
            <Text style={styles.alertValue}>{formatTime(selectedAlert.createdAt)}</Text>
          </View>

          <View style={styles.alertInfo}>
            <Text style={styles.alertLabel}>Escalation</Text>
            <Text style={styles.alertValue}>{formatEscalationLevel(selectedAlert.escalationLevel)}</Text>
          </View>

          {location && (
            <View style={styles.alertInfo}>
              <Text style={styles.alertLabel}>Location</Text>
              <Text style={styles.alertValue} numberOfLines={1}>
                {location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
              </Text>
            </View>
          )}

          {selectedAlert.notes && (
            <View style={styles.alertNotes}>
              <Text style={styles.notesLabel}>Notes:</Text>
              <Text style={styles.notesText}>{selectedAlert.notes}</Text>
            </View>
          )}

          {selectedAlert.escalationLevel < 2 && (
            <View style={styles.escalationTimer}>
              <View style={styles.timerBar}>
                <View
                  style={[
                    styles.timerProgress,
                    {
                      width: `${(escalationTimer / 600) * 100}%`,
                      backgroundColor:
                        escalationTimer < 300 ? '#F59E0B' : '#DC2626',
                    },
                  ]}
                />
              </View>
              <Text style={styles.timerText}>{formatEscalationTime(selectedAlert.escalationLevel)}</Text>
            </View>
          )}
        </View>

        <View style={styles.alertActions}>
          {selectedAlert.status === 'active' && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.acknowledgeButton]}
                onPress={acknowledgeAlert}
                disabled={isLoading}
              >
                <Text style={styles.acknowledgeButtonText}>I'm Responding</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.resolveButton]}
                onPress={resolveAlert}
                disabled={isLoading}
              >
                <Text style={styles.resolveButtonText}>Resolve</Text>
              </TouchableOpacity>
            </>
          )}

          {selectedAlert.escalationLevel >= 1 && (
            <TouchableOpacity
              style={[styles.actionButton, styles.emergencyButton]}
              onPress={callEmergencyServices}
            >
              <Text style={styles.emergencyButtonText}>Call Emergency Services</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Render emergency contacts
  const renderContacts = () => {
    if (contacts.length === 0) return null;

    return (
      <View style={styles.contactsCard}>
        <Text style={styles.contactsTitle}>Emergency Contacts</Text>

        {contacts.map((contact) => (
          <View key={contact.id} style={styles.contactItem}>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>
                {contact.name} {contact.isPrimary && '(Primary)'}
              </Text>
              <Text style={styles.contactRole}>
                {contact.relationship.replace(/_/g, ' ').toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.contactCallButton}
              onPress={() => {
                AlertModal.alert(
                  'Call Contact',
                  `Call ${contact.name} at ${contact.phone}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Call', onPress: () => {} },
                  ]
                );
              }}
            >
              <Text style={styles.contactCallText}>Call</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Emergency</Text>
        <Text style={styles.headerSubtitle}>
          {alertState === 'idle' && 'Tap SOS in case of emergency'}
          {alertState === 'active' && 'Active alert - Take action'}
          {alertState === 'acknowledged' && 'Alert acknowledged'}
          {alertState === 'resolved' && 'Alert resolved'}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Active Alert */}
        {alertState !== 'idle' && renderActiveAlert()}

        {/* SOS Button */}
        {alertState === 'idle' && (
          <View style={styles.sosContainer}>
            <TouchableOpacity
              style={[
                styles.sosButton,
                isLoadingLocation && styles.sosButtonLoading,
              ]}
              onPress={triggerSOS}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading || isLoadingLocation ? (
                <ActivityIndicator size="large" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.sosIcon}>!</Text>
                  <Text style={styles.sosButtonText}>SOS</Text>
                  <Text style={styles.sosSubtext}>Emergency Alert</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.sosWarning}>
              Pressing SOS will immediately notify all emergency contacts
              {location && ' and share your location'}
            </Text>
          </View>
        )}

        {/* Location Status */}
        {!location && alertState === 'idle' && (
          <TouchableOpacity
            style={styles.locationCard}
            onPress={getCurrentLocation}
          >
            <Text style={styles.locationTitle}>Location Services</Text>
            <Text style={styles.locationText}>
              Enable location sharing for emergencies
            </Text>
          </TouchableOpacity>
        )}

        {location && (
          <View style={styles.locationCardEnabled}>
            <Text style={styles.locationTitle}>Location Enabled</Text>
            <Text style={styles.locationText}>
              {location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
            </Text>
          </View>
        )}

        {/* Emergency Contacts */}
        {renderContacts()}
      </ScrollView>

      {/* Quick Actions Footer */}
      {alertState === 'idle' && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={callEmergencyServices}
          >
            <Text style={styles.quickActionIcon}>911</Text>
            <Text style={styles.quickActionText}>Call 911</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#DC2626',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#FEE2E2',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  sosContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  sosButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  sosButtonLoading: {
    opacity: 0.7,
  },
  sosIcon: {
    fontSize: 64,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sosButtonText: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  sosSubtext: {
    fontSize: 12,
    color: '#FEE2E2',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sosWarning: {
    marginTop: 24,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  alertBody: {
    padding: 16,
  },
  alertInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  alertLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  alertValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  alertNotes: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 13,
    color: '#4B5563',
  },
  escalationTimer: {
    marginTop: 16,
  },
  timerBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  timerProgress: {
    height: '100%',
    borderRadius: 3,
  },
  timerText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  alertActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#F9FAFB',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acknowledgeButton: {
    backgroundColor: '#10B981',
  },
  acknowledgeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resolveButton: {
    backgroundColor: '#6B7280',
  },
  resolveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emergencyButton: {
    backgroundColor: '#DC2626',
  },
  emergencyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  locationCardEnabled: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#6B7280',
  },
  contactsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contactsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  contactRole: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  contactCallButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  contactCallText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 16,
    borderRadius: 10,
  },
  quickActionIcon: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginRight: 8,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
