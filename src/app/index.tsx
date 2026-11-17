import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

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

  const currentBgColor = isDarkMode ? '#060B26' : '#F0F3FA'; 
  const currentTextColor = isDarkMode ? '#ffffff' : '#0B132B';
  const currentCardBg = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#ffffff';
  const currentInputBorder = isDarkMode ? '#4D61FC' : '#B2C0FF'; 
  const currentButtonBg = isDarkMode ? '#A14DFF' : '#4D61FC';

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={[styles.container, { backgroundColor: currentBgColor }]}
    >
      <Stack.Screen 
        options={{
          title: 'Flourishing Memories',
          headerStyle: { backgroundColor: isDarkMode ? '#060B26' : '#FFFFFF' },
          headerTintColor: currentTextColor,
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 20,
          },
        }} 
      />

      {/* Transparent Magenta/Purple App Banner Pulled Directly From Logo */}
      {showBanner && (
        <TouchableOpacity 
          style={[
            styles.reminderBanner, 
            { backgroundColor: isDarkMode ? 'rgba(161, 77, 255, 0.15)' : '#F2E6FF' }
          ]} 
          onPress={() => setShowBanner(false)}
          activeOpacity={0.9}
        >
          <View style={styles.bannerContent}>
            <Text style={styles.bannerEmoji}>⏰</Text>
            <View style={styles.bannerTextContainer}>
              <Text style={[styles.bannerTitle, { color: isDarkMode ? '#C599FF' : '#A14DFF' }]}>UPCOMING REMINDER</Text>
              <Text style={[styles.bannerDescription, { color: currentTextColor }]}>
                Call your daughter Amy at 5:00 PM.
              </Text>
            </View>
            <Text style={[styles.dismissText, { color: isDarkMode ? '#C599FF' : '#A14DFF' }]}>✕</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ☀️/🌙 Theme Toggle Button */}
      <View style={styles.toggleRow}>
        <TouchableOpacity 
          style={[styles.toggleButton, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#ffffff' }]} 
          onPress={() => setIsDarkMode(!isDarkMode)}
        >
          <Text style={{ color: isDarkMode ? '#ffffff' : '#4D61FC', fontWeight: '600', fontSize: 13 }}>
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.innerContainer}>
        
        {/* Logo */}
        <Image
          source={require('../../assets/images/logo.webp')}
          style={styles.appLogo}
          resizeMode="contain"
        />

        {/* Greeting */}
        <Text style={[styles.greeting, { color: currentTextColor }]}>
          Hello <Text style={styles.boldHighlight}>{firstName}</Text>, welcome to your personal memory companion.
        </Text>

        {/* Styled Interactive Input Card */}
        <View style={[styles.inputCard, { backgroundColor: currentCardBg }]}>
          <View style={styles.formRow}>
            <TextInput
              style={[
                styles.input, 
                { 
                  backgroundColor: isDarkMode ? '#0B1133' : '#ffffff', 
                  color: currentTextColor, 
                  borderColor: currentInputBorder 
                }
              ]}
              placeholder="Type something to remember..."
              placeholderTextColor={isDarkMode ? '#5F6C95' : '#999'}
              value={text}
              onChangeText={setText}
            />
            
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: currentButtonBg }]} 
              onPress={handleSubmit}
            >
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>
          </View>
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
    top: Platform.OS === 'ios' ? 160 : 140, 
    right: 20,
    zIndex: 10,
  },
  toggleButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reminderBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: '4%',
    right: '4%',
    borderWidth: 1.5, 
    borderColor: 'rgba(161, 77, 255, 0.3)', 
    borderRadius: 16,
    padding: 16, 
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 4,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerEmoji: {
    fontSize: 24, 
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '900', 
    marginBottom: 2,
    letterSpacing: 0.7,
  },
  bannerDescription: {
    fontSize: 16, 
    fontWeight: 'bold', 
    lineHeight: 22,
  },
  dismissText: {
    fontSize: 18, 
    fontWeight: '900',
    paddingLeft: 12,
  },
  innerContainer: {
    width: '90%',
    maxWidth: 450,
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 60, 
  },
  appLogo: {
    width: 130,
    height: 130, 
    marginBottom: 24,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(77, 97, 252, 0.4)', 
    shadowColor: '#A14DFF', 
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14, 
    elevation: 8,
  },
  greeting: {
    fontSize: 21, 
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 28,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-light',
    letterSpacing: -0.2,
  },
  boldHighlight: {
    fontWeight: '700',
  },
  inputCard: {
    width: '100%',
    padding: 20,
    borderRadius: 24,
    alignItems: 'center',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1.5,
    borderRadius: 25, 
    marginRight: 10,
  },
  button: {
    height: 50,
    paddingHorizontal: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25, 
  },
  buttonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
