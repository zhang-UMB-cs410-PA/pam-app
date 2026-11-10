import React, { useState } from 'react';
import { Stack } from 'expo-router';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Alert 
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export default function Index() {
  const [text, setText] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [showBanner, setShowBanner] = useState(true);
  const [firstName, setFirstName] = useState('user');

  const handleSubmit = () => {
    if (text.trim() === '') return;
    Alert.alert('Saved to Memory', `You submitted: "${text}"`);
    setText(''); 
  };

  const currentBgColor = isDarkMode ? '#121212' : '#f4f6f9';
  const currentTextColor = isDarkMode ? '#ffffff' : '#121212';
  const currentInputBg = isDarkMode ? '#1e1e1e' : '#ffffff';
  const currentInputBorder = isDarkMode ? '#333333' : '#cccccc';
  const currentButtonBg = isDarkMode ? '#ffffff' : '#2b579a';
  const currentButtonText = isDarkMode ? '#121212' : '#ffffff';

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={[styles.container, { backgroundColor: currentBgColor }]}
    >
      <Stack.Screen 
        options={{
          title: 'PAM',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }} 
      />

      {/* ⏰ Large-Scale Proactive Banner Notification */}
      {showBanner && (
        <TouchableOpacity 
          style={styles.reminderBanner} 
          onPress={() => setShowBanner(false)}
          activeOpacity={0.9}
        >
          <View style={styles.bannerContent}>
            <Text style={styles.bannerEmoji}>⏰</Text>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>UPCOMING REMINDER</Text>
              <Text style={styles.bannerDescription}>
                Call your daughter Amy at 5:00 PM.
              </Text>
            </View>
            <Text style={styles.dismissText}>✕</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ☀️/🌙 Theme Toggle Button */}
      <View style={styles.toggleRow}>
        <TouchableOpacity 
          style={[styles.toggleButton, { backgroundColor: isDarkMode ? '#1e1e1e' : '#ffffff' }]} 
          onPress={() => setIsDarkMode(!isDarkMode)}
        >
          <Text style={{ color: isDarkMode ? '#ffffff' : '#2b579a', fontWeight: '600', fontSize: 13 }}>
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.innerContainer}>
        {/* 🙂 Integrated Smiley Face Icon */}
        <View style={styles.avatarContainer}>
          <Svg height="80" width="80" viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r="45" fill="#FFDE17" stroke="#000000" strokeWidth="3" />
            <Circle cx="38" cy="40" r="5" fill="#000000" />
            <Circle cx="62" cy="40" r="5" fill="#000000" />
            <Path 
              d="M 25 55 A 25 25 0 0 0 75 55" 
              fill="none" 
              stroke="#000000" 
              strokeWidth="4" 
              strokeLinecap="round" 
            />
          </Svg>
        </View>

        <Text style={[styles.greeting, { color: currentTextColor }]}>
          Hello {firstName}, welcome to your personal memory companion.
        </Text>

        <View style={styles.formRow}>
          <TextInput
            style={[
              styles.input, 
              { 
                backgroundColor: currentInputBg, 
                color: currentTextColor, 
                borderColor: currentInputBorder 
              }
            ]}
            placeholder="Type something to remember..."
            placeholderTextColor={isDarkMode ? '#666' : '#999'}
            value={text}
            onChangeText={setText}
          />
          
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: currentButtonBg }]} 
            onPress={handleSubmit}
          >
            <Text style={[styles.buttonText, { color: currentButtonText }]}>Submit</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 180 : 160, 
    right: 20,
    zIndex: 10,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  reminderBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: '4%',
    right: '4%',
    backgroundColor: '#fff3cd', 
    borderWidth: 2, 
    borderColor: '#ffeeba',
    borderRadius: 16,
    padding: 22, 
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4.65,
    elevation: 6,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerEmoji: {
    fontSize: 30, 
    marginRight: 14,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '900', 
    color: '#856404',
    marginBottom: 4,
    letterSpacing: 0.7,
  },
  bannerDescription: {
    fontSize: 19, 
    fontWeight: 'bold', 
    color: '#533f03', 
    lineHeight: 25,
  },
  dismissText: {
    fontSize: 22, 
    fontWeight: '900',
    color: '#856404',
    paddingLeft: 12,
  },
  innerContainer: {
    width: '90%',
    maxWidth: 450,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 22,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 30,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  input: {
    flex: 1,
    height: 48,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 24, 
    marginRight: 10,
  },
  button: {
    height: 48,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 24, 
  },
  buttonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
