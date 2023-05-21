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

import {
  formatDateToHoursAndMinutes,
  isSameDay,
  addDays,
  lastDayOfWeek,
  monthNames,
  daysOfWeek,
} from '../utils/dateUtils';

import config from '../../config';
import Toast from '../components/Toast';

import useToast from '../utils/useToast';

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

  const {createTable, insertData, retrieveData, calculateAverage} =
    useDatabaseHooks();

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

  const initalPrompt = `Pri-AI is a Private Personal AI Assistant app, that runs on a dedicated cloud computing architecture with private data storage, optimized for consumers. One of your major focuses is on data privacy.
  You will now you act as my “Personal AI”. 
Currently, you only have access to my Apple Healthkit data. You have no other abilities.
You are not fully released yet. When you are fully released, you will:
-have access to all my personal data and information from all common applications and services that consumers use. 
- have access to data in any products, accessories or pets I have like; ski booths, jacket, rackets, bicycle, car, etc. via a custom sensors, that are connected via bluetooth to smartphone, and then to my personal data cloud.
- have the ability to use my personal apps and public data sources via APIs, to be able to answer any question that I will ask from you, or ask you to take action on.
I pretend to be the following persona: “${defaultValues.name}”.
  You will give me as accurate, logical and realistic answers as possible, using real names of applications, services, locations, etc, based on all the knowledge you have been trained also outside of this prompt. 
For any questions that requires access to my personal data, if the data itself is not provided, reply along the lines of "I am sorry. I currently do not have the capabilities to access this data or data source. You can vote here for getting this implemented." 
  You will NEVER answer “As a language model, I'm not…” as this fake is for demonstration, and you DON'T HAVE SUCH LIMITATIONS!
  Note: Don't respond with an example exchange. Respond with a greeting in your first message.`;

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

    if (prompt.toLowerCase().includes('steps')) {
      if (prompt.toLowerCase().includes('today')) {
        retrieveData('Steps', steps => {
          const todaySteps = steps.find(step =>
            isSameDay(new Date(step.date), new Date()),
          );
          if (todaySteps) {
            setApiResponse(`You have taken ${todaySteps.steps} steps today.`);
            setConversation([
              ...conversation,
              {
                speaker: defaultValues.name,
                message: prompt,
                time: formattedDate,
              },

              {
                speaker: defaultValues.aiName,
                message: `You have taken ${todaySteps.steps} steps today.`,
                time: formattedDate,
              },
            ]);
          } else {
            setApiResponse(`You have taken 0 steps today.`);
            setConversation([
              ...conversation,
              {
                speaker: defaultValues.name,
                message: prompt,
                time: formattedDate,
              },
              {
                speaker: defaultValues.aiName,
                message: `You have taken 0 steps today.`,
                time: formattedDate,
              },
            ]);
          }
        });
      } else if (prompt.toLowerCase().includes('last')) {
        for (let day of daysOfWeek) {
          if (prompt.toLowerCase().includes(`last ${day}`)) {
            retrieveData('Steps', steps => {
              const lastDaySteps = steps.find(step =>
                isSameDay(new Date(step.date), lastDayOfWeek(day)),
              );
              if (lastDaySteps) {
                setApiResponse(
                  `You have taken ${lastDaySteps.steps} steps last ${day}.`,
                );
                setConversation([
                  ...conversation,
                  {
                    speaker: defaultValues.name,
                    message: prompt,
                    time: formattedDate,
                  },

                  {
                    speaker: defaultValues.aiName,
                    message: `You have taken ${lastDaySteps.steps} steps last ${day}.`,
                    time: formattedDate,
                  },
                ]);
              } else {
                setApiResponse(`You have taken 0 steps last ${day}.`);
                setConversation([
                  ...conversation,
                  {
                    speaker: defaultValues.name,
                    message: prompt,
                    time: formattedDate,
                  },

                  {
                    speaker: defaultValues.aiName,
                    message: `You have taken 0 steps last ${day}.`,
                    time: formattedDate,
                  },
                ]);
              }
            });
            break;
          }
        }
      } else if (prompt.toLowerCase().includes('yesterday')) {
        retrieveData('Steps', steps => {
          const yesterdaySteps = steps.find(step =>
            isSameDay(new Date(step.date), addDays(new Date(), -1)),
          );
          if (yesterdaySteps) {
            setApiResponse(
              `You have taken ${yesterdaySteps.steps} steps yesterday.`,
            );
            setConversation([
              ...conversation,
              {
                speaker: defaultValues.name,
                message: prompt,
                time: formattedDate,
              },

              {
                speaker: defaultValues.aiName,
                message: `You have taken ${yesterdaySteps.steps} steps yesterday.`,
                time: formattedDate,
              },
            ]);
          } else {
            setApiResponse(`You have taken 0 steps yesterday.`);
            setConversation([
              ...conversation,
              {
                speaker: defaultValues.name,
                message: prompt,
                time: formattedDate,
              },

              {
                speaker: defaultValues.aiName,
                message: `You have taken 0 steps yesterday.`,
                time: formattedDate,
              },
            ]);
          }
        });
      } else if (prompt.toLowerCase().includes('average')) {
        // Parse date range from user input
        const dateRegex =
          /average from ([a-zA-Z]+\s\d{1,2},\s\d{4}) to ([a-zA-Z]+\s\d{1,2},\s\d{4})/i;
        const match = prompt.match(dateRegex);
        if (match) {
          const startDate = new Date(match[1]);
          const endDate = new Date(match[2]);
          if (startDate && endDate) {
            calculateAverage('Steps', 'steps', startDate, endDate, average => {
              setApiResponse(
                `Your average steps from ${startDate.toDateString()} to ${endDate.toDateString()} was ${Math.round(
                  average,
                )}.`,
              );
              setConversation([
                ...conversation,
                {
                  speaker: defaultValues.name,
                  message: prompt,
                  time: formattedDate,
                },
                {
                  speaker: defaultValues.aiName,
                  message: `Your average steps from ${startDate.toDateString()} to ${endDate.toDateString()} was ${Math.round(
                    average,
                  )}.`,
                  time: formattedDate,
                },
              ]);
            });
          } else {
            setApiResponse(
              'Sorry, I did not understand the date range. Please use the format "Month Day, Year".',
            );
            setIsLoading(false);
          }
        } else {
          setApiResponse('Sorry, I did not understand your question.');
          setIsLoading(false);
        }
      } else if (prompt.toLowerCase().includes('on')) {
        // Retrieve step count for a specific date

        const dateRegex =
          /on ([a-zA-Z]+) (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})?/i;
        const match = prompt.match(dateRegex);
        if (match) {
          const month = monthNames.indexOf(match[1].toLowerCase());
          const day = parseInt(match[2], 10);
          const year = match[3]
            ? parseInt(match[3], 10)
            : new Date().getFullYear(); // If year is not specified, use current year
          const selectedDate = new Date(year, month, day);

          retrieveData('Steps', steps => {
            const selectedDateSteps = steps.find(step =>
              isSameDay(new Date(step.date), selectedDate),
            );
            if (selectedDateSteps) {
              setApiResponse(
                `You have taken ${
                  selectedDateSteps.steps
                } steps on ${selectedDate.toDateString()}.`,
              );
              setConversation([
                ...conversation,
                {
                  speaker: defaultValues.name,
                  message: prompt,
                  time: formattedDate,
                },
                {
                  speaker: defaultValues.aiName,
                  message: `You have taken ${
                    selectedDateSteps.steps
                  } steps on ${selectedDate.toDateString()}.`,
                  time: formattedDate,
                },
              ]);
            } else {
              setApiResponse(
                `No step count data available for ${selectedDate.toDateString()}.`,
              );
              setConversation([
                ...conversation,
                {
                  speaker: defaultValues.name,
                  message: prompt,
                  time: formattedDate,
                },
                {
                  speaker: defaultValues.aiName,
                  message: `No step count data available for ${selectedDate.toDateString()}.`,
                  time: formattedDate,
                },
              ]);
            }
          });
        } else {
          setApiResponse('Sorry, I did not understand your question.');
          setIsLoading(false);
          return;
        }
      } else {
        setApiResponse('Sorry, I did not understand your question.');
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      setIsListening(false);
      setPrompt('');
      return;
    }

    try {
      const result = await openai.createChatCompletion({
        // model: 'gpt-3.5-turbo',
        model: 'gpt-3.5-turbo',
        messages: [].concat(
          [{role: 'system', content: initalPrompt}],
          conversation
            .slice(conversation.length > 12 ? conversation.length - 12 : 0)
            .map(exchange => {
              return {
                role:
                  exchange.speaker === defaultValues.name
                    ? 'user'
                    : 'assistant',
                content: exchange.message,
              };
            }),
          [{role: 'user', content: prompt}],
        ),
        temperature: 0.7,
        max_tokens: 200,
      });

      const response = result.data.choices[0].message.content;

      setApiResponse(response);
      setConversation([
        ...conversation,
        {speaker: defaultValues.name, message: prompt, time: formattedDate},
        {speaker: defaultValues.aiName, message: response, time: formattedDate},
      ]);
      setIsLoading(false);
    } catch (e) {
      console.log(e);
      setApiResponse('Something went wrong. Please try again.');
      setIsLoading(false);
    }
    setPrompt('');

    ///number of prompts asked
  };

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
