/**
 * Pharmacy List Screen Placeholder
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const PharmacyListScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Pharmacy List Screen - Implementation Required</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 16, color: '#666' },
});
