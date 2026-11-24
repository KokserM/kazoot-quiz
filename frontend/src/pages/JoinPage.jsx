import React, { useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, Container, Field, Input, Muted, PageMain, PageTitle, Stack } from '../components/ui';
import { isValidRoomCode, normalizeRoomCode } from '../lib/gameUi';
import { saveLastName } from '../lib/storage';

export default function JoinPage() {
  const navigate = useNavigate();
  const { code: pathCode } = useParams();
  const [params] = useSearchParams();
  const [code, setCode] = useState(normalizeRoomCode(pathCode || params.get('code') || ''));
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const codeRef = useRef(null);
  const nameRef = useRef(null);
  const codeInvalid = !isValidRoomCode(code);
  const codeError = codeInvalid && ((touched && code) || submitted) ? 'Room codes have 10 letters and numbers.' : null;
  const nameError = submitted && !name.trim() ? 'Enter a name.' : null;

  // The button stays enabled; on press the first invalid field gets focus and its error.
  const submit = (event) => {
    event.preventDefault();
    setTouched(true);
    setSubmitted(true);
    if (codeInvalid) {
      codeRef.current?.focus();
      return;
    }
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }
    saveLastName(name);
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
                    ref={codeRef}
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
                <Field label="Your name" hint="Shown on the scoreboard" error={nameError}>
                  <Input
                    ref={nameRef}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={24}
                    autoComplete="nickname"
                    autoFocus={Boolean(code)}
                    required
                  />
                </Field>
                <div>
                  <Button type="submit" size="lg">
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
