import React, {useState, useEffect, useContext, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  Button,
} from 'react-native';
import axios from 'axios';
import Share from 'react-native-share';

import {
  UPDATE_AND_PUBLISH_SHARE_COUNT,
  CREATE_AND_PUBLISH_NEW_SHARE,
  GET_SHARE_COUNT,
} from '../utils/queries';

import AppContext from '../hoc/AppContext';

import config from '../../config';
import ContentWrapper from '../components/ContentWrapper';

import ShareButtonIcon from '../assets/button-icons/share-button-icon.svg';
import GiftButtonIcon from '../assets/button-icons/gift-button-icon.svg';
import SmileButtonIcon from '../assets/button-icons/smile-button-icon.svg';
import LinkExternalIcon from '../assets/link-external.svg';

import Toast from '../components/Toast';

import useToast from '../utils/useToast';

const SubscriptionsScreen = () => {
  const {userId, shareCount, setShareCount, shareMessage} =
    useContext(AppContext);

  const {toastConfig, showToast, hideToast} = useToast();

  const [email, setEmail] = useState('');
  const emailRef = useRef(null);

  console.log('userId', userId);

  console.log('share count', shareCount);
  console.log('share message', shareMessage);

  const onShare = async () => {
    const shareOptions = {
      message: shareMessage,
    };

    try {
      const ShareResponse = await Share.open(shareOptions);

      if (ShareResponse.action === Share.sharedAction) {
        const newShareCount = shareCount + 100;

        // get current share count
        const currentShare = await axios.post(config.GRAPHCMS_API_KEY, {
          query: GET_SHARE_COUNT,
          variables: {userId: userId},
        });

        if (currentShare.data.data.share) {
          // if a share with that userId exists, update it
          try {
            await axios.post(config.GRAPHCMS_API_KEY, {
              query: UPDATE_AND_PUBLISH_SHARE_COUNT,
              variables: {userId: userId, shareCount: newShareCount},
            });

            setShareCount(newShareCount);

            Alert.alert(
              'Success',
              'Answers received!',
              [
                {
                  text: 'OK',
                  onPress: () => console.log('OK pressed'),
                },
              ],
              {cancelable: false},
            );
          } catch (error) {
            console.log('Error => 1', error);

            Alert.alert(
              'Error',
              'Sending unsuccessful!',
              [
                {
                  text: 'OK',
                  onPress: () => console.log('OK pressed'),
                },
              ],
              {cancelable: false},
            );
          }
        } else {
          // if a share with that userId doesn't exist, create a new one
          try {
            await axios.post(config.GRAPHCMS_API_KEY, {
              query: CREATE_AND_PUBLISH_NEW_SHARE,
              variables: {userId: userId, shareCount: newShareCount},
            });

            setShareCount(newShareCount);

            Alert.alert(
              'Success',
              'Answers received!',
              [
                {
                  text: 'OK',
                  onPress: () => console.log('OK pressed'),
                },
              ],
              {cancelable: false},
            );
          } catch (error) {
            console.log('Error => 2', error.response);

            Alert.alert(
              'Error',
              'Sending unsuccessful!',
              [
                {
                  text: 'OK',
                  onPress: () => console.log('OK pressed'),
                },
              ],
              {cancelable: false},
            );
          }
        }
      }
    } catch (error) {
      console.log('Error => 3', error);
      Alert.alert(
        'Error',
        'Sending unsuccessful!',
        [
          {
            text: 'OK',
            onPress: () => console.log('OK pressed'),
          },
        ],
        {cancelable: false},
      );
    }
  };

  const onShareEmail = async () => {
    if (!validateEmail(email)) {
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.',
        [
          {
            text: 'OK',
            onPress: () => console.log('OK pressed'),
          },
        ],
        {cancelable: false},
      );
      return;
    }

    try {
      await sendEmailInvitation(email);

      const newShareCount = shareCount + 100;

      // get current share count
      const currentShare = await axios.post(config.GRAPHCMS_API_KEY, {
        query: GET_SHARE_COUNT,
        variables: {userId: userId},
      });

      if (currentShare.data.data.share) {
        // if a share with that userId exists, update it
        try {
          await axios.post(config.GRAPHCMS_API_KEY, {
            query: UPDATE_AND_PUBLISH_SHARE_COUNT,
            variables: {userId: userId, shareCount: newShareCount},
          });

          setShareCount(newShareCount);

          Alert.alert(
            'Success',
            'Invitation sent successfully!',
            [
              {
                text: 'OK',
                onPress: () => console.log('OK pressed'),
              },
            ],
            {cancelable: false},
          );
        } catch (error) {
          console.log('Error => 1', error);

          Alert.alert(
            'Error',
            'Sending unsuccessful!',
            [
              {
                text: 'OK',
                onPress: () => console.log('OK pressed'),
              },
            ],
            {cancelable: false},
          );
        }
      } else {
        // if a share with that userId doesn't exist, create a new one
        try {
          await axios.post(config.GRAPHCMS_API_KEY, {
            query: CREATE_AND_PUBLISH_NEW_SHARE,
            variables: {userId: userId, shareCount: newShareCount},
          });

          setShareCount(newShareCount);

          Alert.alert(
            'Success',
            'Invitation sent successfully!',
            [
              {
                text: 'OK',
                onPress: () => console.log('OK pressed'),
              },
            ],
            {cancelable: false},
          );
        } catch (error) {
          console.log('Error => 2', error.response);

          Alert.alert(
            'Error',
            'Sending unsuccessful!',
            [
              {
                text: 'OK',
                onPress: () => console.log('OK pressed'),
              },
            ],
            {cancelable: false},
          );
        }
      }
    } catch (error) {
      console.log('Error => 3', error);
      Alert.alert(
        'Error',
        'Sending unsuccessful!',
        [
          {
            text: 'OK',
            onPress: () => console.log('OK pressed'),
          },
        ],
        {cancelable: false},
      );
    }
  };

  const sendEmailInvitation = async email => {
    // Implement your email invitation logic here
    // This is just a placeholder function
    // Replace it with your own implementation

    // Example code to send an email invitation
    const response = await axios.post('https://your-email-invitation-api', {
      email: email,
      // Other necessary data for the email invitation
    });

    // Handle the response and check if the invitation was sent successfully
    if (response.status === 200) {
      // Invitation sent successfully
    } else {
      // Failed to send the invitation
      throw new Error('Failed to send email invitation');
    }
  };

  const validateEmail = email => {
    // Implement your email validation logic here
    // This is just a placeholder function
    // Replace it with your own implementation

    // Simple email validation using regular expression
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <>
      {/* {toastConfig && (
        <Toast visible={true} {...toastConfig} onDismiss={hideToast} />
      )} */}
      <ContentWrapper title="Upgrade">
        <Text
          style={{
            fontSize: 18,
            color: '#134E48',
            fontWeight: 600,
            marginBottom: 12,
          }}>
          No questions left?
        </Text>
        <Text style={{fontSize: 18, marginBottom: 40}}>
          No problem, share Pri-AI with friends to receive 100 additional
          questions.
        </Text>
        <View
          style={{
            backgroundColor: '#F6FEFC',
            borderWidth: 1,
            borderColor: '#99F6E0',
            borderRadius: 16,
            padding: 16,
          }}>
          <Text
            style={{
              fontSize: 20,
              color: '#134E48',
              fontWeight: 600,
              marginBottom: 30,
              lineHeight: 30,
            }}>
            How it works
          </Text>
          <View style={{flexDirection: 'row', marginBottom: 24}}>
            <ShareButtonIcon />
            <View style={{marginLeft: 12}}>
              <Text
                style={{
                  fontSize: 18,
                  color: '#134E48',
                  fontWeight: 600,
                  lineHeight: 24,
                }}>
                Invite friends
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#475467',
                  fontWeight: 400,
                  lineHeight: 20,
                }}>
                Click the share button below and
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#475467',
                  fontWeight: 400,
                  lineHeight: 20,
                }}>
                share with friends.
              </Text>
            </View>
          </View>
          <View style={{flexDirection: 'row', marginBottom: 50}}>
            <SmileButtonIcon />
            <View style={{marginLeft: 12}}>
              <Text
                style={{
                  fontSize: 18,
                  color: '#134E48',
                  fontWeight: 600,
                  lineHeight: 24,
                }}>
                Receive your questions
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: '#475467',
                  fontWeight: 400,
                  lineHeight: 20,
                }}>
                We will add 100 questions to your quota.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={{
              marginHorizontal: 12,
              height: 48,
              backgroundColor: shareMessage == '' ? 'gray' : '#0E9384',
              borderRadius: 8,
              padding: 10,
              marginTop: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 32,
            }}
            title="Share"
            onPress={onShare}
            disabled={shareMessage == '' ? true : false}>
            <Text
              style={{
                color: 'white',
                lineHeight: 24,
                fontSize: 16,
                fontWeight: '600',
                marginRight: 8,
              }}>
              Invite friends
            </Text>

            <LinkExternalIcon />
          </TouchableOpacity>
          <Text
            style={{
              textAlign: 'center',
              fontSize: 14,
              color: '#475467',
              fontWeight: 400,
              lineHeight: 20,
            }}>
            {shareMessage == ''
              ? 'Inviting friends will be available soon!'
              : null}
          </Text>
        </View>
        <View>
          <Text>Invite by email</Text>

          <TextInput
            ref={emailRef}
            placeholder="Enter email"
            onChangeText={text => setEmail(text)}
            value={email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Button title="Invite" onPress={onShareEmail} />
        </View>
      </ContentWrapper>
    </>
  );
};

export default SubscriptionsScreen;
