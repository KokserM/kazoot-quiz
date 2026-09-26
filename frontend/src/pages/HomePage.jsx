import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { HeroMark } from '../components/BrandMark';
import { AnswerGrid } from '../components/game/AnswerGrid';
import { Countdown } from '../components/game/Countdown';
import { Icon } from '../components/Icon';
import { PlanGrid, PricingExplainer } from '../components/Pricing';
import { Card, Container, Eyebrow, LinkButton, Muted, Row, SectionTitle, Stack } from '../components/ui';
import { track } from '../lib/analytics';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/support';
import { useCatalog, useConfig } from '../lib/useConfig';

const Hero = styled.section`
  padding: clamp(28px, 6vw, 80px) 0 clamp(36px, 6vw, 80px);
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

// Logo + category: the brand introduces the promise, then steps back.
const Lockup = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  p {
    display: grid;
    gap: 2px;
  }
  strong {
    font-family: var(--font-display);
    font-size: 1.35rem;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }
`;

const Headline = styled.h1`
  font-size: clamp(2.5rem, 5vw, 4.1rem);
  font-weight: 800;
  line-height: 0.98;
  letter-spacing: -0.04em;
  .line {
    display: block;
    @media (min-width: 700px) {
      white-space: nowrap;
    }
  }

  /* The payoff line takes the logo's violet → magenta stroke. Both ends are readable on paper. */
  em {
    font-style: normal;
    color: var(--brand-a);
    @supports (-webkit-background-clip: text) or (background-clip: text) {
      background: linear-gradient(100deg, var(--brand-a) 10%, var(--brand-b) 90%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    @media (forced-colors: active) {
      -webkit-text-fill-color: currentColor;
      background: none;
    }
  }
`;

const Lead = styled.p`
  font-size: clamp(1.1rem, 2vw, 1.3rem);
  color: var(--ink-2);
  max-width: 34em;
`;

// On phones both actions span the column instead of wrapping to ragged widths.
const Actions = styled(Row)`
  @media (max-width: 480px) {
    > * {
      flex: 1 1 100%;
    }
  }
`;

const Reassure = styled.p`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  color: var(--ink-2);
  font-size: 0.95rem;
  span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  svg {
    color: var(--success);
  }
`;

// The preview is a real piece of the game UI, rendered in the stage theme.
const Preview = styled.figure`
  margin: 0;
  padding: clamp(18px, 2.6vw, 28px);
  border-radius: 24px;
  background: var(--paper);
  color: var(--ink);
  border: 1px solid var(--line);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.06) inset, 0 40px 70px -34px rgba(76, 29, 149, 0.6), 0 18px 30px -24px rgba(16, 10, 28, 0.6);

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
  background: ${({ $sunk }) => ($sunk ? 'var(--band)' : 'transparent')};
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
    background: var(--accent);
    color: var(--accent-ink);
    font-family: var(--font-display);
    font-weight: 800;
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
    border-left: 3px solid var(--accent);
  }
  strong {
    display: block;
  }
`;

// A divided list, not a stack of boxes: hairlines between questions, the whole row is the
// target, and a +/× toggle on the right replaces the browser's disclosure triangle.
const Faq = styled.div`
  border-top: 1px solid var(--line);

  details {
    border-bottom: 1px solid var(--line);
  }
  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 20px 0;
    cursor: pointer;
    list-style: none;
    font-family: var(--font-display);
    font-size: clamp(1.05rem, 2vw, 1.2rem);
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.01em;
    transition: color 140ms ease;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:hover {
    color: var(--accent-text);
  }
  summary:focus-visible {
    outline-offset: 4px;
  }
  .toggle {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: var(--accent-soft);
    color: var(--accent-text);
    transition: background-color 160ms ease, color 160ms ease;
    svg {
      transition: transform 200ms var(--ease-out);
    }
  }
  summary:hover .toggle {
    background: var(--accent);
    color: var(--accent-ink);
  }
  /* The plus turns into a close mark; the tile itself stays square. */
  details[open] .toggle {
    background: var(--accent);
    color: var(--accent-ink);
    svg {
      transform: rotate(45deg);
    }
  }
  details p {
    max-width: 62ch;
    padding: 0 52px 22px 0;
    color: var(--ink-2);
  }
`;

// Closing call to action on the game's own stage colours.
const Finale = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: clamp(24px, 5vw, 48px);
  border-radius: 24px;
  background: var(--paper);
  color: var(--ink);
  border: 1px solid var(--line);
  h2 {
    max-width: 17em;
    font-size: clamp(1.5rem, 3.2vw, 2.2rem);
    font-weight: 800;
  }
  p {
    margin-top: 8px;
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
  const heroRef = useRef(null);

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
      <Hero ref={heroRef}>
        <HeroGrid>
          <Stack $gap={24}>
            <Lockup>
              <HeroMark areaRef={heroRef} />
              <p>
                <strong>Kazoot</strong>
                <Eyebrow as="span">Live quiz game for groups</Eyebrow>
              </p>
            </Lockup>
            <Headline>
              <span className="line">Pick a topic.</span>{' '}
              <span className="line">Everyone plays —</span>{' '}
              <em className="line">including you.</em>
            </Headline>
            <Lead>
              Kazoot writes a 10-question quiz on the topic you choose. Friends join on their phones with a code — and because you haven’t seen the
              questions either, you get to play too.
            </Lead>
            <Actions $gap={12}>
              <LinkButton to="/demo" size="lg">
                Try a free demo
                <Icon name="arrowRight" />
              </LinkButton>
              <LinkButton to="/create" size="lg" variant="secondary">
                Create a quiz
              </LinkButton>
            </Actions>
            <Reassure>
              <span>
                <Icon name="check" /> Demo: no account, no card
              </span>
              <span>
                <Icon name="check" /> Your own topics: {config?.freeAiGamesPerMonth ?? 3} free quizzes a month
              </span>
            </Reassure>
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
                  <summary>
                    {question}
                    <span className="toggle" aria-hidden="true">
                      <Icon name="plus" />
                    </span>
                  </summary>
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
          <Finale data-stage-scope="">
            <div>
              <SectionTitle>See how it feels — the demo takes two minutes.</SectionTitle>
              <p>No account, no card. Play solo or with whoever is in the room.</p>
            </div>
            <Row>
              <LinkButton to="/demo" size="lg">
                Try a free demo
                <Icon name="arrowRight" />
              </LinkButton>
              <LinkButton to="/join" size="lg" variant="secondary">
                Join a game
              </LinkButton>
            </Row>
          </Finale>
        </Container>
      </Band>
    </main>
  );
}
