import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { AnswerGrid } from '../components/game/AnswerGrid';
import { Countdown } from '../components/game/Countdown';
import { Icon } from '../components/Icon';
import { PlanGrid, PricingExplainer } from '../components/Pricing';
import { Card, Container, Eyebrow, LinkButton, Muted, Row, SectionTitle, Stack } from '../components/ui';
import { track } from '../lib/analytics';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/support';
import { useCatalog, useConfig } from '../lib/useConfig';

const Hero = styled.section`
  padding: clamp(32px, 7vw, 88px) 0 clamp(32px, 6vw, 72px);
`;

const HeroGrid = styled(Container)`
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: clamp(28px, 5vw, 64px);
  align-items: center;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Headline = styled.h1`
  font-size: clamp(2.4rem, 4.6vw, 3.9rem);
  line-height: 1;
  letter-spacing: -0.035em;
  .line {
    display: block;
    @media (min-width: 700px) {
      white-space: nowrap;
    }
  }

  em {
    font-style: normal;
    color: var(--accent-text);
  }
`;

const Lead = styled.p`
  font-size: clamp(1.1rem, 2vw, 1.3rem);
  color: var(--ink-2);
  max-width: 34em;
`;

// The preview is a real piece of the game UI, rendered in the stage theme.
const Preview = styled.figure`
  margin: 0;
  padding: clamp(18px, 2.6vw, 28px);
  border-radius: 24px;
  background: var(--paper);
  color: var(--ink);
  border: 1px solid var(--line);
  box-shadow: 0 30px 60px -30px rgba(11, 16, 32, 0.55);

  figcaption {
    margin-top: 14px;
    font-size: 0.88rem;
    color: var(--ink-3);
  }
`;

const PreviewTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--ink-3);
  font-weight: 700;
  font-size: 0.88rem;
  margin-bottom: 12px;
`;

const Band = styled.section`
  padding: clamp(40px, 7vw, 80px) 0;
  border-top: 1px solid var(--line);
  background: ${({ $sunk }) => ($sunk ? 'var(--surface-sunk)' : 'transparent')};
`;

const Steps = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(16px, 3vw, 32px);
  counter-reset: step;
  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
  li {
    counter-increment: step;
  }
  li::before {
    content: counter(step);
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    margin-bottom: 14px;
    border-radius: 12px;
    background: var(--accent-soft);
    color: var(--accent-text);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.2rem;
  }
  h3 {
    font-size: 1.35rem;
    margin-bottom: 6px;
  }
`;

const Split = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: clamp(20px, 4vw, 56px);
  align-items: start;
  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
`;

const Plain = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  li {
    padding-left: 18px;
    border-left: 3px solid var(--line-strong);
  }
  strong {
    display: block;
  }
`;

const Faq = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  details {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 0 18px;
  }
  summary {
    cursor: pointer;
    padding: 16px 0;
    font-weight: 700;
    font-size: 1.05rem;
    list-style-position: outside;
  }
  details p {
    padding: 0 0 16px;
    color: var(--ink-2);
  }
`;

const FAQ = [
  ['Do players need an account or an app?', 'No. Players open the join page in any browser, type the room code and a name. Only the person creating a quiz on their own topic signs in.'],
  [
    'How is the demo different from a real quiz?',
    'The demo uses hand-written quizzes that are the same for everyone, so it costs nothing to run. When you create your own quiz, Kazoot writes fresh questions for your topic. Everything else — joining, timing, scoring — is the same game.',
  ],
  [
    'Can the questions be wrong?',
    'Yes, occasionally. Questions are written by AI and checked automatically for format, duplicates and obvious giveaways, but not by a person. If accuracy matters, for example in class, choose “Let me check first” to review and edit them before playing.',
  ],
  [
    'What topics work best?',
    'Broad or well-known subjects: history, geography, science, films, music, sport, food, famous people and places. AI can’t know private things like your colleagues’ habits or a family story, and it declines topics that aren’t suitable for a general audience.',
  ],
  [
    'What if someone’s phone disconnects?',
    'They reopen the page and carry on with the same seat and score. If the host drops out, the game waits for them briefly; after that the longest-connected player can keep it moving until the host is back.',
  ],
  ['Can I show it on a big screen?', 'Yes, but you don’t have to: questions and answers appear on every player’s device. If you host from a laptop on a projector, the room can follow along there too.'],
  [
    'Is it OK for schools and children?',
    'Players only enter a nickname — no account, email or other personal details. Topics are screened and questions are generated for a general audience, but no automated filter is perfect, so teachers should use review mode. Accounts for creating quizzes are for adults.',
  ],
  ['How do refunds and cancellation work?', 'Subscriptions can be cancelled any time from your account and stop at the end of the paid month. If creating a quiz fails, you get the AI game back automatically. See Refunds & cancellation for details.'],
];

export default function HomePage() {
  const { config } = useConfig();
  const { plans } = useCatalog();
  const pricingRef = useRef(null);

  useEffect(() => track('landing_view', {}, { oncePerSession: true }), []);
  useEffect(() => {
    const node = pricingRef.current;
    if (!node || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        track('pricing_viewed', {}, { oncePerSession: true });
        observer.disconnect();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <main>
      <Hero>
        <HeroGrid>
          <Stack $gap={22}>
            <Eyebrow>Live quiz game for groups</Eyebrow>
            <Headline>
              <span className="line">Pick a topic.</span>{' '}
              <span className="line">Everyone plays —</span>{' '}
              <em className="line">including you.</em>
            </Headline>
            <Lead>
              Kazoot writes a 10-question quiz on the topic you choose. Friends join on their phones with a code — and because you haven’t seen the
              questions either, you get to play too.
            </Lead>
            <Row $gap={12}>
              <LinkButton to="/demo" size="lg">
                Try a free demo
              </LinkButton>
              <LinkButton to="/create" size="lg" variant="secondary">
                Create a quiz
              </LinkButton>
            </Row>
            <Muted $small>
              Demo: no account, no card. Your own topics: sign in with Google, {config?.freeAiGamesPerMonth ?? 3} free quizzes a month.
            </Muted>
          </Stack>

          <Preview aria-label="Preview of the question screen" data-stage-scope="">
            <Stack $gap={14} aria-hidden="true" inert>
              <PreviewTop>
                <span>Question 3 of 10</span>
                <span>
                  <Icon name="users" /> 7 of 9 answered
                </span>
              </PreviewTop>
              <h2 style={{ fontSize: 'clamp(1.3rem, 2.4vw, 1.75rem)', lineHeight: 1.15 }}>Which spice comes from the dried stigmas of a crocus flower?</h2>
              <Countdown question={{ timeLimit: 20000 }} remainingMs={12400} />
              <AnswerGrid choices={['Turmeric', 'Saffron', 'Cardamom', 'Paprika']} selectedIndex={1} selectionStatus="locked" disabled onSelect={() => {}} />
            </Stack>
            <figcaption>The real question screen, shown with a question from the free demo.</figcaption>
          </Preview>
        </HeroGrid>
      </Hero>

      <Band id="how-it-works">
        <Container>
          <Stack $gap={32}>
            <SectionTitle>Ready in about a minute</SectionTitle>
            <Steps>
              <li>
                <h3>Pick a topic</h3>
                <Muted>Type something like “Nordic mythology” or “90s pop”. Choose English or Estonian, the difficulty and the timer.</Muted>
              </li>
              <li>
                <h3>Invite</h3>
                <Muted>Players go to {window.location.host}/join and type the code, or scan the QR code on your screen. No app to install.</Muted>
              </li>
              <li>
                <h3>Play</h3>
                <Muted>Everyone answers on their own device. Correct answers score more the faster they come. Standings after every question.</Muted>
              </li>
            </Steps>
          </Stack>
        </Container>
      </Band>

      <Band $sunk>
        <Container>
          <Split>
            <Stack $gap={14}>
              <SectionTitle>The organiser doesn’t have to sit out</SectionTitle>
              <Muted>
                Usually whoever writes the quiz knows every answer. With Kazoot, questions stay hidden until they appear on screen — for the host
                too. You start the game from your phone and compete like everyone else.
              </Muted>
              <Muted>
                <strong>Teaching or running a work session?</strong> Choose “Let me check first” to review and edit the questions before you start.
                Players see that the host has seen them.
              </Muted>
            </Stack>
            <Card>
              <Stack $gap={12}>
                <Eyebrow>Good to know</Eyebrow>
                <Plain>
                  <li>
                    <strong>AI can be wrong.</strong>
                    Questions are checked automatically, not by a person. Use review mode when accuracy matters.
                  </li>
                  <li>
                    <strong>Best with well-known topics.</strong>
                    Kazoot doesn’t know your office gossip or family stories.
                  </li>
                  <li>
                    <strong>Up to {config?.maxPlayersPerRoom ?? 150} players per game.</strong>
                    Each needs a phone or laptop with internet.
                  </li>
                  <li>
                    <strong>English and Estonian.</strong>
                    Questions are written in the language you pick.
                  </li>
                </Plain>
              </Stack>
            </Card>
          </Split>
        </Container>
      </Band>

      <Band id="pricing" ref={pricingRef}>
        <Container>
          <Stack $gap={22}>
            <Stack $gap={10}>
              <SectionTitle>Pricing</SectionTitle>
              <Muted>Start free. Pay only if you host often.</Muted>
            </Stack>
            {plans ? <PlanGrid plans={plans} config={config} /> : <Muted role="status">Loading prices…</Muted>}
            <PricingExplainer />
          </Stack>
        </Container>
      </Band>

      <Band $sunk>
        <Container $narrow>
          <Stack $gap={22}>
            <SectionTitle>Questions</SectionTitle>
            <Faq>
              {FAQ.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}</summary>
                  <p>{answer}</p>
                </details>
              ))}
            </Faq>
            <Muted>
              Something else? Email <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.
            </Muted>
          </Stack>
        </Container>
      </Band>

      <Band>
        <Container>
          <Row $justify="space-between" $gap={20}>
            <SectionTitle style={{ maxWidth: '18em' }}>See how it feels — the demo takes two minutes.</SectionTitle>
            <Row>
              <LinkButton to="/demo" size="lg">
                Try a free demo
              </LinkButton>
              <LinkButton to="/join" size="lg" variant="secondary">
                Join a game
              </LinkButton>
            </Row>
          </Row>
        </Container>
      </Band>
    </main>
  );
}
