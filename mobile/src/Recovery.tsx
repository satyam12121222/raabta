import React, { useState } from 'react';
import { api } from './api';
import { Body, Button, Field, Panel, Title } from './ui';
export function Recovery({ busy, act, onBack }: {busy:boolean;act:(fn:()=>Promise<void>)=>Promise<void>;onBack:()=>void}) {
  const [email,setEmail] = useState(''), [code,setCode] = useState(''), [password,setPassword] = useState(''), [sent,setSent] = useState(false), [done,setDone] = useState(false);
  return <Panel>
    <Title>Find your way back.</Title>
    {done ? <Body>Password reset. All old sessions have been signed out. Sign in with your new password.</Body> : <>
      <Body>Enter your verified recovery email. We never send your password by email.</Body>
      <Field label="Email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} value={email} onChangeText={setEmail} />
      <Button busy={busy} secondary title={sent ? 'Resend recovery code' : 'Send recovery code'} onPress={() => act(async () => { await api('/auth/recovery','POST',{email}); setSent(true); })} />
      {sent && <>
        <Body>If a verified account exists, a code will arrive shortly. Check spam too.</Body>
        <Field label="8-digit code" keyboardType="number-pad" maxLength={8} value={code} onChangeText={setCode} />
        <Field label="New password (12+ characters)" secureTextEntry value={password} onChangeText={setPassword} />
        <Button busy={busy} title="Reset password" disabled={code.length !== 8 || password.length < 12} onPress={() => act(async () => { await api('/auth/reset','POST',{email,code,password}); setPassword(''); setCode(''); setDone(true); })} />
      </>}
    </>}
    <Button secondary title="Back to sign in" onPress={onBack} />
  </Panel>;
}
