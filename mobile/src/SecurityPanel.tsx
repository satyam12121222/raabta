import React, { useState } from 'react';
import { api, saveToken } from './api';
import { User } from './types';
import { Body, Button, Field, Label, Panel } from './ui';

type Props = { user: User; busy: boolean; act: (fn: () => Promise<void>) => Promise<void>; refresh: () => Promise<void>; onLogout: () => void };
export function SecurityPanel({ user, busy, act, refresh, onLogout }: Props) {
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [notice, setNotice] = useState('');
  const [password, setPassword] = useState(''), [nextPassword, setNextPassword] = useState('');
  const [memory, setMemory] = useState<string | null>(null), [people, setPeople] = useState<{id:string;name:string}[] | null>(null);
  return <>
    <Panel>
      <Label>Account security</Label>
      <Body>{user.email || 'Add a recovery email'} · {user.emailVerified ? 'Verified email' : 'Not verified'}</Body>
      {!user.email && <>
        <Field label="Recovery email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
        <Field label="Current password" secureTextEntry value={password} onChangeText={setPassword} />
        <Button busy={busy} title="Save recovery email" onPress={() => act(async () => { await api('/auth/email', 'PUT', { email, password }); setPassword(''); await refresh(); })} />
      </>}
      {!!user.email && !user.emailVerified && <>
        <Body>Verify this email before AI conversations and matching. Email verification confirms access to an inbox, not identity or age.</Body>
        <Button busy={busy} secondary title="Send verification code" onPress={() => act(async () => { await api('/auth/verify/send','POST',{}); setNotice('Code sent. Check your inbox and spam folder; it expires in 10 minutes.'); })} />
        <Field label="8-digit email code" keyboardType="number-pad" maxLength={8} value={code} onChangeText={setCode} />
        <Button busy={busy} title="Verify email" disabled={code.length !== 8} onPress={() => act(async () => { await api('/auth/verify','POST',{code}); setCode(''); setNotice('Email verified. You can start your conversations.'); await refresh(); })} />
      </>}
      {!!notice && <Body>{notice}</Body>}
      <Field label="Current password" secureTextEntry value={password} onChangeText={setPassword} />
      <Field label="New password (12+ characters)" secureTextEntry value={nextPassword} onChangeText={setNextPassword} />
      <Button busy={busy} secondary title="Change password & sign out other devices" disabled={!password || nextPassword.length < 12} onPress={() => act(async () => {
        const r = await api<{token:string}>('/auth/password','PUT',{currentPassword:password,password:nextPassword});
        await saveToken(r.token); setPassword(''); setNextPassword(''); setNotice('Password changed. Other devices are signed out.');
      })} />
      <Button busy={busy} secondary title="Sign out all devices" onPress={() => act(async () => { await api('/auth/logout-all','POST',{}); await saveToken(''); onLogout(); })} />
    </Panel>
    <Panel>
      <Label>What your AI remembers</Label>
      <Body>Your private preference summary helps conversations continue across days. It is never shared with a match. Correct it or clear it whenever you want.</Body>
      <Button secondary busy={busy} title="Review remembered preferences" onPress={() => act(async () => { setMemory((await api<{memory:string}>('/me/memory')).memory); })} />
      {memory !== null && <>
        <Field label="Private preference memory" value={memory} onChangeText={setMemory} multiline maxLength={12000} />
        <Body>Clearing this summary does not erase chat history. Use Erase AI history to remove both.</Body>
        <Button busy={busy} title="Save my corrections" onPress={() => act(async () => { await api('/me/memory','PUT',{memory}); setMemory(null); })} />
      </>}
    </Panel>
    <Panel>
      <Label>Blocked members</Label>
      <Button secondary busy={busy} title="Manage blocked members" onPress={() => act(async () => { setPeople((await api('/blocks')).people); })} />
      {people?.length === 0 && <Body>No blocked members.</Body>}
      {people?.map(p => <Button key={p.id} secondary busy={busy} title={`Unblock ${p.name}`} onPress={() => act(async () => { await api('/blocks','DELETE',{target:p.id}); setPeople(people.filter(x => x.id !== p.id)); })} />)}
      <Body>Unblocking does not restore old introductions or chats.</Body>
    </Panel>
  </>;
}
