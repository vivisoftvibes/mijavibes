/**
 * Caregiver Home Screen (SPEC-005: CG-001)
 *
 * Displays monitored patients with current status, quick actions, and last update
 * Shows patient cards with medication status, vitals, and quick action buttons
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types';
import { useCaregiverStore, usePatientCards } from '../store/useCaregiverStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const CaregiverHomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    loadPatients,
    isLoadingPatients,
    error,
    clearError,
    selectPatient,
  } = useCaregiverStore();

  const patientCards = usePatientCards();

  useEffect(() => {
    loadPatients();
  }, []);

  const handleRefresh = () => {
    clearError();
    loadPatients();
  };

  const handlePatientPress = (patientId: string) => {
    selectPatient(patientId);
    navigation.navigate('PatientDetail', { patientId });
  };

  const handleCall = (patientId: string, phone?: string) => {
    if (phone) {
      // Log the call action
      useCaregiverStore.getState().logAction(patientId, 'called_patient', {
        notes: `Called ${phone}`,
      });
      // In real implementation, use Linking.openURL(`tel:${phone}`)
    }
  };

  const handleMessage = (patientId: string) => {
    useCaregiverStore.getState().logAction(patientId, 'called_patient', {
      notes: 'Initiated message',
    });
  };

  const getStatusColor = (status: 'all_good' | 'attention_needed' | 'critical') => {
    switch (status) {
      case 'all_good':
        return '#10B981';
      case 'attention_needed':
        return '#F59E0B';
      case 'critical':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: 'all_good' | 'attention_needed' | 'critical') => {
    switch (status) {
      case 'all_good':
        return 'All Good';
      case 'attention_needed':
        return 'Attention Needed';
      case 'critical':
        return 'Needs Care';
      default:
        return 'Unknown';
    }
  };

  const formatAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return null;
    const birth = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Patients</Text>
        <Text style={styles.headerSubtitle}>
          {patientCards.length} {patientCards.length === 1 ? 'patient' : 'patients'}
        </Text>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <Text style={styles.errorDismiss}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Patient Cards */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoadingPatients} onRefresh={handleRefresh} />
        }
      >
        {isLoadingPatients && patientCards.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0066CC" />
            <Text style={styles.loadingText}>Loading patients...</Text>
          </View>
        ) : patientCards.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No Patients Yet</Text>
            <Text style={styles.emptyText}>
              Ask a patient to invite you as their caregiver
            </Text>
          </View>
        ) : (
          patientCards.map((patient) => {
            const age = formatAge(patient.dateOfBirth);
            const statusColor = getStatusColor(patient.status);
            const statusLabel = getStatusLabel(patient.status);

            return (
              <TouchableOpacity
                key={patient.id}
                style={styles.patientCard}
                onPress={() => handlePatientPress(patient.id)}
                activeOpacity={0.7}
              >
                {/* Status Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.patientInfo}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {patient.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.patientDetails}>
                      <View style={styles.nameRow}>
                        <Text style={styles.patientName}>{patient.name}</Text>
                        {patient.isPrimary && (
                          <View style={styles.primaryBadge}>
                            <Text style={styles.primaryBadgeText}>Primary</Text>
                          </View>
                        )}
                      </View>
                      {age && (
                        <Text style={styles.patientMeta}>Age: {age}</Text>
                      )}
                    </View>
                  </View>
                  <View style={[styles.statusIndicator, { backgroundColor: statusColor }]}>
                    <Text style={styles.statusText}>{statusLabel}</Text>
                  </View>
                </View>

                {/* Medications Section */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionIcon}>💊</Text>
                    <Text style={styles.sectionTitle}>Medications</Text>
                    <Text style={styles.sectionValue}>
                      {patient.medications.taken}/{patient.medications.total} taken
                    </Text>
                  </View>
                  {patient.medications.total > 0 && (
                    <View style={styles.medicationProgress}>
                      <View
                        style={[
                          styles.medicationProgressBar,
                          {
                            width: `${(patient.medications.taken / patient.medications.total) * 100}%`,
                            backgroundColor:
                              patient.medications.taken === patient.medications.total
                                ? '#10B981'
                                : '#0066CC',
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>

                {/* Vitals Section */}
                {(patient.vitals.bp || patient.vitals.glucose) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionIcon}>📊</Text>
                    <Text style={styles.sectionTitle}>Vital Signs</Text>
                    <View style={styles.vitalsRow}>
                      {patient.vitals.bp && (
                        <View style={styles.vitalItem}>
                          <Text style={styles.vitalLabel}>BP</Text>
                          <Text
                            style={[
                              styles.vitalValue,
                              patient.vitals.bp.isAbnormal && styles.vitalAbnormal,
                            ]}
                          >
                            {patient.vitals.bp.systolic}/{patient.vitals.bp.diastolic}
                          </Text>
                          <Text style={styles.vitalTime}>{patient.vitals.bp.time}</Text>
                        </View>
                      )}
                      {patient.vitals.glucose && (
                        <View style={styles.vitalItem}>
                          <Text style={styles.vitalLabel}>Glucose</Text>
                          <Text
                            style={[
                              styles.vitalValue,
                              patient.vitals.glucose.isAbnormal && styles.vitalAbnormal,
                            ]}
                          >
                            {patient.vitals.glucose.value}
                          </Text>
                          <Text style={styles.vitalTime}>{patient.vitals.glucose.time}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                {/* Quick Actions */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleCall(patient.id, patient.phone)}
                  >
                    <Text style={styles.actionIcon}>📱</Text>
                    <Text style={styles.actionLabel}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleMessage(patient.id)}
                  >
                    <Text style={styles.actionIcon}>💬</Text>
                    <Text style={styles.actionLabel}>Message</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handlePatientPress(patient.id)}
                  >
                    <Text style={styles.actionIcon}>📋</Text>
                    <Text style={styles.actionLabel}>Details</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Bottom spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
    flex: 1,
  },
  errorDismiss: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  patientDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  primaryBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  primaryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  patientMeta: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  sectionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  medicationProgress: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  medicationProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  vitalsRow: {
    flexDirection: 'row',
    gap: 24,
  },
  vitalItem: {
    flex: 1,
  },
  vitalLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  vitalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  vitalAbnormal: {
    color: '#EF4444',
  },
  vitalTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  actionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  bottomSpacer: {
    height: 20,
  },
});
