import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { config } from '../config.js';
import { consumeOtp, createOtp, findRecentOtp, getOtp, reserveOtpAttempt } from './store.js';
import { cleanEmail, cleanPhone } from '../utils/normalize.js';
import { AppError } from '../utils/errors.js';
import { signOtpVerification } from './tokens.js';

const awsClientOptions = () => ({
  region: config.aws.region,
  ...(config.aws.accessKeyId && config.aws.secretAccessKey ? {
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey
    }
  } : {})
});

const createCode = () => crypto.randomInt(100000, 1_000_000).toString();

const deliveryAvailable = (channel) => channel === 'email'
  ? Boolean(config.aws.region && config.aws.sesFromEmail)
  : Boolean(config.aws.region);

const deliverEmail = async (destination, code) => {
  const client = new SESClient(awsClientOptions());
  try {
    await client.send(new SendEmailCommand({
      Source: config.aws.sesFromEmail,
      Destination: { ToAddresses: [destination] },
      Message: {
        Subject: { Data: 'Your Social Media Mother verification code', Charset: 'UTF-8' },
        Body: {
          Text: { Data: `Your verification code is ${code}. It expires in ${config.otpTtlMinutes} minutes.`, Charset: 'UTF-8' },
          Html: { Data: `<p>Your Social Media Mother verification code is <strong>${code}</strong>.</p><p>It expires in ${config.otpTtlMinutes} minutes.</p>`, Charset: 'UTF-8' }
        }
      }
    }));
  } finally {
    client.destroy();
  }
};

const deliverPhone = async (destination, code) => {
  const client = new SNSClient(awsClientOptions());
  try {
    await client.send(new PublishCommand({
      PhoneNumber: destination,
      Message: `Social Media Mother code: ${code}. Expires in ${config.otpTtlMinutes} minutes.`,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
        ...(config.aws.snsOriginationNumber ? {
          'AWS.SNS.SMS.OriginationNumber': { DataType: 'String', StringValue: config.aws.snsOriginationNumber }
        } : {})
      }
    }));
  } finally {
    client.destroy();
  }
};

export const requestOtp = async ({ channel, destination }) => {
  if (!['email', 'phone'].includes(channel)) {
    throw new AppError(422, 'channel must be email or phone', 'INVALID_OTP_CHANNEL');
  }
  const normalizedDestination = channel === 'email' ? cleanEmail(destination) : cleanPhone(destination);
  const recent = await findRecentOtp(channel, normalizedDestination, new Date(Date.now() - 60_000));
  if (recent) throw new AppError(429, 'Please wait one minute before requesting another code', 'OTP_RESEND_COOLDOWN');
  const canDeliver = deliveryAvailable(channel);
  if (!canDeliver && config.isProduction) {
    throw new AppError(503, `${channel === 'email' ? 'AWS SES' : 'AWS SNS'} is not configured`, 'OTP_DELIVERY_NOT_CONFIGURED');
  }

  const code = createCode();
  const expiresAt = new Date(Date.now() + config.otpTtlMinutes * 60_000);
  const challenge = await createOtp({
    channel,
    destination: normalizedDestination,
    codeHash: await bcrypt.hash(code, 10),
    attempts: 0,
    expiresAt
  });

  if (canDeliver) {
    try {
      if (channel === 'email') await deliverEmail(normalizedDestination, code);
      else await deliverPhone(normalizedDestination, code);
    } catch (error) {
      console.error('OTP delivery failed', error);
      throw new AppError(502, 'The verification code could not be delivered', 'OTP_DELIVERY_FAILED');
    }
  }

  return {
    challengeId: challenge.id,
    channel,
    destination: normalizedDestination,
    expiresAt,
    delivery: canDeliver ? 'aws' : 'local-demo',
    ...(!canDeliver && !config.isProduction ? { devOtp: code } : {})
  };
};

export const verifyOtp = async ({ challengeId, code }) => {
  const challenge = await reserveOtpAttempt(challengeId);
  if (!challenge) {
    const existing = await getOtp(challengeId);
    if (existing && new Date(existing.expiresAt).getTime() <= Date.now()) {
      throw new AppError(400, 'The verification code has expired', 'OTP_EXPIRED');
    }
    if (existing && (existing.attempts || 0) >= 5) {
      throw new AppError(429, 'Too many incorrect verification attempts', 'OTP_ATTEMPTS_EXCEEDED');
    }
    throw new AppError(400, 'This verification challenge is invalid or already used', 'INVALID_OTP');
  }

  const valid = /^\d{6}$/.test(String(code)) && await bcrypt.compare(String(code), challenge.codeHash);
  if (!valid) {
    throw new AppError(400, 'The verification code is incorrect', 'INCORRECT_OTP');
  }

  const consumed = await consumeOtp(challengeId);
  if (!consumed) throw new AppError(400, 'This verification challenge is invalid or already used', 'INVALID_OTP');
  return {
    verificationToken: signOtpVerification({
      challengeId: String(challenge.id || challenge._id),
      channel: challenge.channel,
      destination: challenge.destination
    }),
    channel: challenge.channel,
    destination: challenge.destination
  };
};
