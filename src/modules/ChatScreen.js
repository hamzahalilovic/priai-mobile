import 'react-native-url-polyfill/auto';

import React, {
  useState,
  useLayoutEffect,
  useContext,
  useEffect,
  useRef,
} from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Button,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';

import {useHeaderHeight} from '@react-navigation/elements';

import {Configuration, OpenAIApi} from 'openai';

import AppContext from '../hoc/AppContext';
import DotLoader from '../components/DotLoader';

import Voice from '@react-native-voice/voice';

import SendIcon from '../assets/send-icon.svg';
import MicrophoneIcon from '../assets/microphone.svg';
import UpgradeIcon from '../assets/upgrade-button-icon.svg';
import ChatItem from './chat/ChatItem';

import SendIconDisabled from '../assets/send-icon-disabled.svg';

import AsyncStorage from '@react-native-async-storage/async-storage';

import useDatabaseHooks from '../utils/useDatabaseHooks';

import {formatDateToHoursAndMinutes} from '../utils/dateUtils';

import config from '../../config';
import Toast from '../components/Toast';

import useToast from '../utils/useToast';

import handleStepsQuery from './chat/handlers/stepsHandler';
import handleCaloriesQuery from './chat/handlers/caloriesHandler';

const configuration = new Configuration({
  apiKey: config.OPENAI_API_KEY,
});

// console.log('env', config.OPENAI_API_KEY);

const openai = new OpenAIApi(configuration);

const ChatScreen = ({navigation, route}) => {
  const {
    defaultValues,
    checkHKStatus,
    numberOfPrompts,
    setNumberOfPrompts,
    shareCount,
  } = useContext(AppContext);

  const {retrieveData} = useDatabaseHooks();

  const {toastConfig, showToast, hideToast} = useToast();

  const [isLoading, setIsLoading] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [apiResponse, setApiResponse] = useState('');
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState();

  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');

  const [firstLaunch, setFirstLaunch] = useState(null);

  const [quota, setQuota] = useState(false);

  const deviceHeight = useHeaderHeight();

  const timeStamp = Date.now();

  const formattedDate = formatDateToHoursAndMinutes(timeStamp);

  const getThreads = async () => {
    const {thread} = route.params;
    const existingThreads = await AsyncStorage.getItem('threads');

    console.log('existing thread', existingThreads);
    let threads = [];
    if (existingThreads) threads = JSON.parse(existingThreads);
    const currentThread = threads.find(t => t.id === thread.id);
    if (currentThread) setConversation(currentThread.messages);
  };

  const saveThreads = async () => {
    const {thread} = route.params;
    const existingThreads = await AsyncStorage.getItem('threads');
    let threads = [];
    if (existingThreads) threads = JSON.parse(existingThreads);
    const updatedThreads = threads.map(t =>
      t.id === thread.id
        ? {...t, messages: conversation, timeLastEdited: timeStamp}
        : t,
    );
    await AsyncStorage.setItem('threads', JSON.stringify(updatedThreads));
  };

  useEffect(() => {
    getThreads();
  }, []);

  useEffect(() => {
    return () => {
      saveThreads();
    };
  }, [conversation]);

  const handleClearChat = () => {
    setConversation([]);

    setIsLoading(false);
    setIsListening(false);

    showToast('Your action was successful!', 'success');
  };

  useEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        conversation.length !== 0 ? (
          <TouchableOpacity
            style={{marginRight: 16}}
            onPress={() => handleClearChat()}
            title="Save">
            <Text style={{color: '#107569', fontSize: 14, fontWeight: 600}}>
              Clear chat
            </Text>
          </TouchableOpacity>
        ) : null,
    });
  }, [conversation]);

  // check for first launch
  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const value = await AsyncStorage.getItem('firstLaunch');
        if (value === null) {
          // first launch, set firstLaunch in AsyncStorage to false
          await AsyncStorage.setItem('firstLaunch', 'false');
          setFirstLaunch(true);
        } else {
          setFirstLaunch(false);
        }
      } catch (error) {
        // error trying to get value from AsyncStorage
        console.log('AsyncStorage Error: ' + error);
      }
    };
    checkFirstLaunch();
  }, []);

  useEffect(() => {
    if (firstLaunch === true) {
      checkHKStatus();
    }
  }, [firstLaunch]);

  const handleSubmit = async () => {
    setIsLoading(true);

    if (prompt.toLowerCase().includes('steps')) {
      const {apiResponse, conversation} = handleStepsQuery(
        prompt,
        defaultValues,
        formattedDate,
        retrieveData,
      );
      setApiResponse(apiResponse);
      setConversation(conversation);
    } else if (prompt.toLowerCase().includes('calories')) {
      const {apiResponse, conversation} = handleCaloriesQuery(
        prompt,
        defaultValues,
        formattedDate,
        retrieveData,
      );
      setApiResponse(apiResponse);
      setConversation(conversation);
    } else {
      try {
        const result = await openai.createCompletion({
          model: 'text-davinci-003',
          prompt: prompt,
          temperature: 0,
          max_tokens: 200,
        });
        const response = result.data.choices[0].text;
        setApiResponse(response);
        setConversation([
          ...conversation,
          {speaker: defaultValues.name, message: prompt, time: formattedDate},
          {
            speaker: defaultValues.aiName,
            message: response,
            time: formattedDate,
          },
        ]);
        setIsLoading(false);
      } catch (e) {
        console.log(e);
        setApiResponse('Something went wrong. Please try again.');
        setIsLoading(false);
      }
    }

    setPrompt('');

    ///number of prompts asked
    try {
      const newNumberOfPrompts = numberOfPrompts + 1;
      setNumberOfPrompts(newNumberOfPrompts);
      await AsyncStorage.setItem(
        'numberOfPrompts',
        newNumberOfPrompts.toString(),
      );

      if (numberOfPrompts === shareCount) {
        setQuota(true);
        Alert.alert(
          'Alert',
          'No more answers left!',
          [{text: 'OK', onPress: () => console.log('OK pressed')}],
          {cancelable: false},
        );
      }
    } catch (error) {
      console.log(error);
    }
  };

  ////=========////=========////=========////=========////=========////=========////=========////=========////========= siri

  useEffect(() => {
    Voice.onSpeechStart = onSpeechStart;
    Voice.onSpeechEnd = onSpeechEnd;
    Voice.onSpeechError = onSpeechError;
    Voice.onSpeechResults = onSpeechResults;
  }, []);

  const onSpeechStart = () => {
    setPrompt('');

    setIsListening(true);
  };

  const onSpeechEnd = () => {
    // setIsListening(false);
    // handleSubmit();
  };

  const onSpeechError = error => {
    console.log('onSpeechError:', error);
  };

  const onSpeechResults = event => {
    setPrompt(event.value[0]);
  };

  const startListening = () => {
    Voice.start('en-US');
  };

  const stopListening = () => {
    Voice.stop();
    handleSubmit();
  };

  /////////=========////=========////=========////=========////=========////=========////=========////=========

  const scrollViewRef = useRef();

  useEffect(() => {
    scrollViewRef.current.scrollToEnd({animated: true});
  }, [conversation]);

  console.log('conversation', conversation);
  console.log('prompts / count', numberOfPrompts, shareCount);

  return (
    // <View style={styles.container}>
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={deviceHeight + 89}>
      {/* add error state */}
      {toastConfig && (
        <Toast visible={true} {...toastConfig} onDismiss={hideToast} />
      )}
      <View style={styles.quotaContainer}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <Text style={styles.quotaText}>
            {numberOfPrompts}/{shareCount}
          </Text>
          <Text style={[styles.quotaText, {marginLeft: 5}]}>
            {!quota ? 'Questions used' : 'Quota full'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.quotaButton}
          onPress={() => navigation.navigate('Subscriptions')}>
          <UpgradeIcon />
          <Text style={{fontSize: 14, marginLeft: 4, color: '#3538CD'}}>
            Upgrade
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        keyboardDismissMode="interactive"
        style={styles.conversationContainer}
        ref={scrollViewRef}
        onContentSizeChange={() =>
          scrollViewRef.current.scrollToEnd({animated: true})
        }>
        {conversation.map((item, index) => (
          <View key={index} style={styles.conversationEntry}>
            <ChatItem
              type={item.speaker === defaultValues.name ? 'entry' : 'response'}
              title={item.speaker}
              time={item.time}
              message={item.message}
            />
          </View>
        ))}
      </ScrollView>

      {/* {isListening ? <DotLoader isLoading={isListening} /> : null} */}
      {/* <Button title="Get steps" onPress={handleSteps} />
      <Button title="create table" onPress={createTable} /> */}
      <View style={{marginBottom: 10}}>
        {isLoading ? <ActivityIndicator size="large" /> : null}
      </View>
      {!quota ? (
        <View style={styles.inputWrapper}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="How many steps did I take today?"
              placeholderTextColor="#aaa"
              returnKeyType="done"
            />
            <View style={styles.iconsContainer}>
              <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
                {isLoading ? <SendIconDisabled /> : <SendIcon />}
              </TouchableOpacity>
              <TouchableOpacity
                style={{marginLeft: 5, marginRight: 5}}
                // onPressIn={startListening}
                // onPressOut={stopListening}

                onPress={isListening ? stopListening : startListening}>
                {isListening ? (
                  <DotLoader isLoading={isListening} />
                ) : (
                  <MicrophoneIcon />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <></>
      )}
    </KeyboardAvoidingView>
    // </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  conversationContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  conversationEntry: {
    paddingVertical: 5,
  },
  promptText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  responseText: {
    fontSize: 18,
    marginBottom: 10,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 6,
    paddingHorizontal: 24,
    height: 48,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',

    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  icon: {
    paddingHorizontal: 10,
  },
  responseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  quotaContainer: {
    height: 38,
    backgroundColor: '#2D31A6',
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quotaText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'white',
    fontWeight: 500,
  },
  quotaButton: {
    backgroundColor: '#EEF4FF',
    borderRadius: 16,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default ChatScreen;
