import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Hello GoShed</Text>
        <Text style={styles.subtitle}>Native scaffold is wired and ready.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6f7fb',
  },
  card: {
    width: '88%',
    maxWidth: 420,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderColor: '#e7e9f0',
    borderWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#374151',
  },
});
