import React, { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, Container, Field, Input, Muted, PageMain, PageTitle, Stack } from '../components/ui';
import { isValidRoomCode, normalizeRoomCode } from '../lib/gameUi';

export default function JoinPage() {
  const navigate = useNavigate();
  const { code: pathCode } = useParams();
  const [params] = useSearchParams();
  const [code, setCode] = useState(normalizeRoomCode(pathCode || params.get('code') || ''));
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const codeError = touched && code && !isValidRoomCode(code) ? 'Room codes have 10 letters and numbers.' : null;

  const submit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (!isValidRoomCode(code) || !name.trim()) return;
    navigate(`/session/${code}`, { state: { username: name.trim() } });
  };

  return (
    <PageMain>
      <Container $narrow>
        <Stack $gap={20}>
          <PageTitle>Join a game</PageTitle>
          <Muted>Enter the code on the host’s screen. No account needed.</Muted>
          <Card>
            <form onSubmit={submit} noValidate>
              <Stack $gap={18}>
                <Field label="Room code" hint="10 letters and numbers, like ABCDE 23456" error={codeError}>
                  <Input
                    value={code}
                    onChange={(event) => setCode(normalizeRoomCode(event.target.value))}
                    onBlur={() => setTouched(true)}
                    inputMode="text"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '0.12em' }}
                    autoFocus={!code}
                    required
                  />
                </Field>
                <Field label="Your name" hint="Shown on the scoreboard">
                  <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} autoComplete="nickname" autoFocus={Boolean(code)} required />
                </Field>
                <div>
                  <Button type="submit" size="lg" disabled={!name.trim() || !isValidRoomCode(code)}>
                    Join game
                  </Button>
                </div>
              </Stack>
            </form>
          </Card>
        </Stack>
      </Container>
    </PageMain>
  );
}
