/**
 * Patient Detail Screen (SPEC-005: CG-004)
 *
 * Comprehensive patient view for caregivers including:
 * - Today's status with medication adherence
 * - Today's medications with detailed status
 * - Recent vital signs with abnormality indicators
 * - Recent alerts with acknowledgment status
 * - Activity timeline showing caregiver actions
 * - Quick actions (call, message, video)
 * - Other caregivers monitoring the same patient
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, PatientDetail } from '../types';
import { useCaregiverStore } from '../store/useCaregiverStore';

type PatientDetailScreenRouteProp = RouteProp<RootStackParamList, 'PatientDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  route: PatientDetailScreenRouteProp;
}

export const PatientDetailScreen: React.FC<Props> = ({ route }) => {
  const navigation = useNavigation<NavigationProp>();
  const { patientId } = route.params;

  const {
    patientDetails,
    isLoadingDetail,
    loadPatientDetail,
    loadActivityLog,
    activityLog,
    logAction,
    callPatient,
    messagePatient,
    startVideoCall,
    error,
    clearError,
  } = useCaregiverStore();

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState('');

  const patientDetail = patientDetails[patientId];

  useEffect(() => {
    loadPatientDetail(patientId);
    loadActivityLog(patientId);
  }, [patientId]);

  const handleCall = () => {
    const phone = patientDetail?.patient.phone;
    if (phone) {
      callPatient(patientId, phone);
    } else {
      Alert.alert('No Phone Number', 'This patient has no phone number on file.');
    }
  };

  const handleAddNote = () => {
    if (noteText.trim()) {
      logAction(patientId, 'added_note', { notes: noteText });
      setNoteText('');
      setShowNoteModal(false);
    }
  };

  const handleAlertPress = (alert: any) => {
    if (alert.status === 'active') {
      Alert.alert(
        'Alert Details',
        `${alert.type.replace(/_/g, ' ').toUpperCase()}\n\nSeverity: ${alert.severity}\nCreated: ${new Date(alert.createdAt).toLocaleString()}`,
        [
          { text: 'Close', style: 'cancel' },
          {
            text: 'Acknowledge',
            onPress: () => logAction(patientId, 'acknowledged', { alertId: alert.id }),
          },
        ]
      );
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getMedicationStatusColor = (status: string) => {
    switch (status) {
      case 'taken':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'missed':
        return '#EF4444';
      case 'skipped':
        return '#6B7280';
      default:
        return '#9CA3AF';
    }
  };

  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#DC2626';
      case 'high':
        return '#F59E0B';
      case 'warning':
        return '#3B82F6';
      default:
        return '#6B7280';
    }
  };

  if (isLoadingDetail && !patientDetail) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Loading patient details...</Text>
      </View>
    );
  }

  if (!patientDetail) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Failed to Load Patient</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadPatientDetail(patientId)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { patient, relationship, medications, vitals, alerts, activity, otherCaregivers } = patientDetail;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{patient.name}</Text>
          <Text style={styles.headerSubtitle}>
            {relationship.role === 'primary' ? 'Primary Caregiver' : `${relationship.role} caregiver`}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Today's Status Summary */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <View style={styles.statusIconContainer}>
                <Text style={styles.statusIcon}>💊</Text>
              </View>
              <Text style={styles.statusLabel}>Medications</Text>
              <Text style={styles.statusValue}>
                {medications.today.filter(m => m.status === 'taken').length}/{medications.today.length}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={styles.statusIconContainer}>
                <Text style={styles.statusIcon}>❤️</Text>
              </View>
              <Text style={styles.statusLabel}>Vitals</Text>
              <Text style={styles.statusValue}>
                {vitals.bloodPressure.some(v => !v.isAbnormal) && vitals.glucose.some(v => !v.isAbnormal)
                  ? 'Normal'
                  : 'Check'}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <View style={styles.statusIconContainer}>
                <Text style={styles.statusIcon}>🔔</Text>
              </View>
              <Text style={styles.statusLabel}>Alerts</Text>
              <Text style={styles.statusValue}>
                {alerts.filter(a => a.status === 'active').length}
              </Text>
            </View>
          </View>
        </View>

        {/* Today's Medications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Medications</Text>
          <View style={styles.weeklyStats}>
            <Text style={styles.weeklyStatsText}>
              This week: {medications.week.taken} of {medications.week.total} taken ({medications.week.adherence}%)
            </Text>
          </View>
          {medications.today.map(med => (
            <View key={`${med.id}-${med.scheduledTime}`} style={styles.medicationCard}>
              <View style={styles.medicationInfo}>
                <View style={styles.medicationHeader}>
                  <Text style={styles.medicationName}>{med.name}</Text>
                  <View
                    style={[
                      styles.medicationStatusBadge,
                      { backgroundColor: getMedicationStatusColor(med.status) },
                    ]}
                  >
                    <Text style={styles.medicationStatusText}>{med.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.medicationDosage}>{med.dosage}</Text>
                <Text style={styles.medicationTime}>
                  Scheduled: {formatTime(med.scheduledTime)}
                  {med.takenAt && ` • Taken: ${formatTime(med.takenAt)}`}
                </Text>
              </View>
              {med.status === 'pending' && relationship.permissions.modifySchedule && (
                <TouchableOpacity
                  style={styles.markSkippedButton}
                  onPress={() => logAction(patientId, 'marked_skipped', {
                    notes: `Skipped ${med.name}`,
                  })}
                >
                  <Text style={styles.markSkippedText}>Skip</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Recent Vitals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Vital Signs</Text>

          {vitals.bloodPressure.length > 0 && (
            <View style={styles.vitalSection}>
              <View style={styles.vitalSectionHeader}>
                <Text style={styles.vitalSectionTitle}>Blood Pressure</Text>
              </View>
              {vitals.bloodPressure.map(bp => (
                <View key={bp.id} style={styles.vitalReading}>
                  <View>
                    <Text style={styles.vitalReadingValue}>
                      {bp.systolic}/{bp.diastolic} mmHg
                    </Text>
                    <Text style={styles.vitalReadingTime}>{formatDate(bp.measuredAt.toString())}</Text>
                  </View>
                  {bp.isAbnormal && (
                    <View style={styles.abnormalBadge}>
                      <Text style={styles.abnormalText}>High</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {vitals.glucose.length > 0 && (
            <View style={styles.vitalSection}>
              <View style={styles.vitalSectionHeader}>
                <Text style={styles.vitalSectionTitle}>Glucose</Text>
              </View>
              {vitals.glucose.map(glucose => (
                <View key={glucose.id} style={styles.vitalReading}>
                  <View>
                    <Text style={styles.vitalReadingValue}>{glucose.value} mg/dL</Text>
                    <Text style={styles.vitalReadingTime}>{formatDate(glucose.measuredAt.toString())}</Text>
                  </View>
                  {glucose.isAbnormal && (
                    <View style={styles.abnormalBadge}>
                      <Text style={styles.abnormalText}>High</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Alerts</Text>
            {alerts.slice(0, 5).map(alert => (
              <TouchableOpacity
                key={alert.id}
                style={styles.alertCard}
                onPress={() => handleAlertPress(alert)}
              >
                <View
                  style={[
                    styles.alertIndicator,
                    { backgroundColor: getAlertSeverityColor(alert.severity) },
                  ]}
                />
                <View style={styles.alertContent}>
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertType}>{alert.type.replace(/_/g, ' ').toUpperCase()}</Text>
                    <Text style={styles.alertTime}>{formatDate(alert.createdAt.toString())}</Text>
                  </View>
                  {alert.acknowledgedAt && (
                    <Text style={styles.acknowledgedBy}>
                      Acknowledged by {alert.acknowledgedBy} • {formatDate(alert.acknowledgedAt.toString())}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Activity Timeline */}
        {activity.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Activity Timeline</Text>
            {activity.slice(0, 10).map((item, index) => (
              <View key={item.id} style={styles.activityItem}>
                <View style={styles.activityTimeline}>
                  <View style={[styles.activityDot, index === 0 && styles.activityDotActive]} />
                  {index < activity.length - 1 && <View style={styles.activityLine} />}
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityType}>{item.type.replace(/_/g, ' ').toUpperCase()}</Text>
                  {item.description && (
                    <Text style={styles.activityDescription}>{item.description}</Text>
                  )}
                  <Text style={styles.activityTime}>{formatDate(item.createdAt.toString())}</Text>
                  {item.caregiver && (
                    <Text style={styles.activityCaregiver}>by {item.caregiver.name}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Other Caregivers */}
        {otherCaregivers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Other Caregivers</Text>
            {otherCaregivers.map(caregiver => (
              <View key={caregiver.id} style={styles.caregiverRow}>
                <View style={styles.caregiverAvatar}>
                  <Text style={styles.caregiverAvatarText}>
                    {caregiver.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.caregiverInfo}>
                  <Text style={styles.caregiverName}>{caregiver.name}</Text>
                  <Text style={styles.caregiverRole}>
                    {caregiver.role === 'primary' ? 'Primary' : caregiver.role}
                  </Text>
                </View>
                <View
                  style={[
                    styles.caregiverStatusDot,
                    { backgroundColor: caregiver.status === 'active' ? '#10B981' : '#9CA3AF' },
                  ]}
                />
              </View>
            ))}
          </View>
        )}

        {/* Patient Info Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Patient Information</Text>
          <View style={styles.infoCard}>
            {patient.email && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{patient.email}</Text>
              </View>
            )}
            {patient.phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{patient.phone}</Text>
              </View>
            )}
            {patient.emergencyContactName && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Emergency Contact</Text>
                <Text style={styles.infoValue}>
                  {patient.emergencyContactName} • {patient.emergencyContactPhone}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Quick Actions Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton} onPress={handleCall}>
          <Text style={styles.footerIcon}>📱</Text>
          <Text style={styles.footerLabel}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => {
            messagePatient(patientId);
          }}
        >
          <Text style={styles.footerIcon}>💬</Text>
          <Text style={styles.footerLabel}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => {
            startVideoCall(patientId);
          }}
        >
          <Text style={styles.footerIcon}>📹</Text>
          <Text style={styles.footerLabel}>Video</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => setShowNoteModal(true)}
        >
          <Text style={styles.footerIcon}>📝</Text>
          <Text style={styles.footerLabel}>Note</Text>
        </TouchableOpacity>
      </View>

      {/* Add Note Modal */}
      <Modal visible={showNoteModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowNoteModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Note</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Enter your note..."
              multiline
              value={noteText}
              onChangeText={setNoteText}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowNoteModal(false);
                  setNoteText('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleAddNote}
              >
                <Text style={styles.modalButtonTextConfirm}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#111827',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIcon: {
    fontSize: 20,
  },
  statusLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  section: {
    marginTop: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  weeklyStats: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  weeklyStatsText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  medicationCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  medicationInfo: {
    flex: 1,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  medicationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  medicationStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  medicationStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  medicationDosage: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  medicationTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  markSkippedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  markSkippedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  vitalSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  vitalSectionHeader: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  vitalSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  vitalReading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  vitalReadingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  vitalReadingTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  abnormalBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  abnormalText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  alertTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  acknowledgedBy: {
    fontSize: 12,
    color: '#6B7280',
  },
  activityItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  activityTimeline: {
    alignItems: 'center',
    marginRight: 12,
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D1D5DB',
  },
  activityDotActive: {
    backgroundColor: '#0066CC',
  },
  activityLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginTop: -6,
    minHeight: 40,
  },
  activityContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
  },
  activityType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0066CC',
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  activityCaregiver: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  caregiverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  caregiverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  caregiverAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  caregiverInfo: {
    flex: 1,
  },
  caregiverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  caregiverRole: {
    fontSize: 14,
    color: '#6B7280',
  },
  caregiverStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  footerButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  footerIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  footerLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  noteInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F3F4F6',
  },
  modalButtonConfirm: {
    backgroundColor: '#0066CC',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
