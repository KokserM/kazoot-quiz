import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { DeviceStage } from '../components/home/DeviceStage';
import { MobileDock } from '../components/home/MobileDock';
import { InviteVignette, LeaderboardVignette, TopicVignette } from '../components/home/StepVignettes';
import { Icon } from '../components/Icon';
import { PlanGrid, PricingExplainer } from '../components/Pricing';
import { Container, Eyebrow, LinkButton, Muted, textStyle } from '../components/ui';
import { track } from '../lib/analytics';
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from '../lib/support';
import { useReveal } from '../lib/useReveal';
import { useCatalog, useConfig } from '../lib/useConfig';

// Direction 1 "Stage Lights" home page (design-review/brief-direction-1.md, section 6.1).
// Effects: E1 glows and E2 grain on the hero and finale (decorative pseudo-elements inside
// an isolated section), E3/E4/E8 in the device stage, E6 sheen on the hero's primary
// button, E7 scroll-reveal (useReveal; nothing above the fold).

// Decorative layers shared by the hero and the finale: glows (::before) and grain (::after).
const grain = `
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background: url('/brand/grain-128.png') repeat;
    opacity: var(--grain-opacity);
  }
`;

const Hero = styled.section`
  position: relative;
  isolation: isolate;
  padding: clamp(28px, 4.5vw, 52px) 0 0;
  text-align: center;
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(48% 42% at 18% 0%, var(--glow-a), transparent 70%),
      radial-gradient(44% 40% at 84% 6%, var(--glow-b), transparent 70%),
      radial-gradient(60% 40% at 50% 100%, var(--glow-c), transparent 70%);
  }
  ${grain}

  /* On a laptop the top of the host screen (status row, question, timer) is above the fold. */
  @media (min-width: 1000px) and (max-height: 820px) {
    padding-top: 28px;
    h1 { margin-top: 10px; }
    .hero-actions { margin-top: 20px; }
    .hero-reassure { margin-top: 12px; }
    figure { margin-top: 28px; }
  }
`;

const HeroEyebrow = styled(Eyebrow)`
  /* It sits on a glow: --ink-2, never --ink-3. */
  color: var(--ink-2);
`;

const Headline = styled.h1`
  ${textStyle.hero}
  margin: 14px auto 0;
  max-width: 13ch;
  .line {
    display: block;
  }
  @media (min-width: 1000px) {
    max-width: none;
    .line:not(em) {
      display: inline;
    }
    em.line {
      display: block;
    }
  }
  @media (min-width: 1000px) and (max-height: 820px) {
    font-size: 4rem;
  }

  /* The payoff line takes the logo's violet → magenta stroke. */
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
  ${textStyle.lead}
  color: var(--ink-2);
  max-width: 36em;
  margin: 18px auto 0;
`;

// On phones both actions span the column (demo first) instead of wrapping raggedly.
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 24px;
  @media (max-width: 480px) {
    > * {
      flex: 1 1 100%;
    }
  }
`;

const Reassure = styled.p`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 20px;
  margin-top: 16px;
  color: var(--ink-2);
  font-size: 0.95rem;
  span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }
  svg {
    color: var(--success);
  }
`;

const Section = styled.section`
  padding: var(--section-y) 0;
  background: ${({ $band }) => ($band ? 'var(--band)' : 'var(--paper)')};
  ${({ $band }) => ($band ? 'border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);' : '')}
`;

const H2 = styled.h2`
  ${textStyle.h2}
`;

const Steps = styled.ol`
  list-style: none;
  margin: clamp(24px, 4vw, 44px) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(14px, 2vw, 22px);
  counter-reset: step;
  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }

  > li {
    counter-increment: step;
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-radius: 22px;
    border: 1px solid var(--line);
    background: var(--surface);
    overflow: hidden;
  }
  /* Single column on wide cards: vignette left, text right. */
  @media (min-width: 561px) and (max-width: 900px) {
    > li {
      display: grid;
      grid-template-columns: 42% minmax(0, 1fr);
      align-items: stretch;
    }
    > li .txt {
      align-self: center;
    }
  }

  .txt {
    padding: 20px 22px 24px;
  }
  h3 {
    ${textStyle.h3}
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }
  h3::before {
    content: counter(step);
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 11px;
    background: var(--ink);
    color: var(--paper);
    font-family: var(--font-display);
    font-weight: 800;
    font-size: 1.1rem;
    letter-spacing: 0;
  }
  .txt p {
    color: var(--ink-2);
    font-size: 1rem;
  }
`;

const Split = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
  gap: clamp(24px, 5vw, 64px);
  align-items: end;
  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }
  h2 {
    ${textStyle.display}
  }
  .lead {
    ${textStyle.lead}
    color: var(--ink-2);
    max-width: 34em;
    margin-top: 18px;
  }
  .note {
    padding: 22px;
    border-radius: 20px;
    border: 1px solid var(--line);
    background: var(--surface);
    color: var(--ink-2);
    font-size: 1rem;
  }
  .note strong {
    color: var(--ink);
  }
`;

const Answers = styled.ul`
  list-style: none;
  margin: clamp(28px, 4vw, 44px) 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(14px, 2vw, 22px);
  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
  }
  li {
    padding: 22px;
    border-radius: var(--radius-lg);
    border: 1px solid var(--line);
    background: var(--surface);
    box-shadow: inset 0 3px 0 var(--edge);
  }
  h3 {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.2rem;
    line-height: 1.2;
    color: var(--ink);
  }
  p {
    margin-top: 8px;
    font-size: 1rem;
    color: var(--ink-2);
  }
`;

const PricingHead = styled.div`
  p {
    margin-top: 10px;
    color: var(--ink-2);
  }
`;

const PricingBody = styled.div`
  margin-top: clamp(22px, 3vw, 32px);
  display: grid;
  gap: 18px;
  min-width: 0;
`;

// Title and "Good to know" on the left, the accordion on the right; on phones the
// quiet list moves after the accordion.
const Questions = styled(Container)`
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.6fr);
  grid-template-rows: auto 1fr;
  grid-template-areas: 'title faq' 'know faq';
  gap: 0 clamp(20px, 5vw, 64px);
  .q-title { grid-area: title; }
  .q-know { grid-area: know; margin-top: 28px; }
  .q-faq { grid-area: faq; min-width: 0; }
  @media (max-width: 800px) {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: none;
    grid-template-areas: 'title' 'faq' 'know';
    .q-faq { margin-top: 22px; }
    .q-know { margin-top: 36px; }
  }
`;

const Know = styled.ul`
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  li {
    padding: 14px 0;
    border-top: 1px solid var(--line);
    color: var(--ink-2);
    font-size: 0.95rem;
  }
  strong {
    display: block;
    color: var(--ink);
    font-size: 1rem;
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
    gap: 16px;
    min-height: 56px;
    padding: 16px 0;
    cursor: pointer;
    list-style: none;
    font-family: var(--font-display);
    font-size: clamp(1.05rem, 2vw, 1.2rem);
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.01em;
    transition: color var(--dur-fast) ease;
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
    transition: background-color var(--dur-fast) ease, color var(--dur-fast) ease;
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
    padding: 0 48px 20px 0;
    color: var(--ink-2);
  }
`;

const More = styled(Muted)`
  margin-top: 18px;
`;

// Closing call to action: a full-bleed dark band (stage palette in both themes).
const Finale = styled.section`
  position: relative;
  isolation: isolate;
  padding: clamp(56px, 9vw, 120px) 0;
  border-top: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink);
  text-align: center;
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(50% 70% at 50% 100%, var(--glow-b), transparent 70%),
      radial-gradient(40% 50% at 20% 100%, var(--glow-a), transparent 70%);
  }
  ${grain}
  h2 {
    ${textStyle.display}
    max-width: 16ch;
    margin: 0 auto;
  }
  p {
    margin-top: 14px;
    font-size: 1.15rem;
    color: var(--ink-2);
  }
`;

// Three answers that schools and work teams look for, shown as cards (quick win 8);
// the accordion keeps the rest. Text verbatim from the former single FAQ list.
const SURFACED = [
  [
    'Is it OK for schools and children?',
    'Players only enter a nickname — no account, email or other personal details. Topics are screened and questions are generated for a general audience, but no automated filter is perfect, so teachers should use review mode. Accounts for creating quizzes are for adults.',
  ],
  [
    'Can the questions be wrong?',
    'Yes, occasionally. Questions are written by AI and checked automatically for format, duplicates and obvious giveaways, but not by a person. If accuracy matters, for example in class, choose “Let me check first” to review and edit them before playing.',
  ],
  ['Can I show it on a big screen?', 'Yes, but you don’t have to: questions and answers appear on every player’s device. If you host from a laptop on a projector, the room can follow along there too.'],
];
const SURFACED_EDGES = ['var(--answer-d)', 'var(--answer-c)', 'var(--answer-a)'];

const FAQ = [
  ['Do players need an account or an app?', 'No. Players open the join page in any browser, type the room code and a name. Only the person creating a quiz on their own topic signs in.'],
  [
    'How is the demo different from a real quiz?',
    'The demo uses hand-written quizzes that are the same for everyone, so it costs nothing to run. When you create your own quiz, Kazoot writes fresh questions for your topic. Everything else — joining, timing, scoring — is the same game.',
  ],
  [
    'What topics work best?',
    'Broad or well-known subjects: history, geography, science, films, music, sport, food, famous people and places. AI can’t know private things like your colleagues’ habits or a family story, and it declines topics that aren’t suitable for a general audience.',
  ],
  [
    'What if someone’s phone disconnects?',
    'They reopen the page and carry on with the same seat and score. If the host drops out, the game waits for them briefly; after that the longest-connected player can keep it moving until the host is back.',
  ],
  ['How do refunds and cancellation work?', 'Subscriptions can be cancelled any time from your account and stop at the end of the paid month. If creating a quiz fails, you get the AI game back automatically. See Refunds & cancellation for details.'],
];

function DemoLink(props) {
  return (
    <LinkButton to="/demo" size="lg" {...props}>
      Try a free demo
      <Icon name="arrowRight" />
    </LinkButton>
  );
}

export default function HomePage() {
  const { config } = useConfig();
  const { plans } = useCatalog();
  const mainRef = useRef(null);
  const pricingRef = useRef(null);
  const heroActionsRef = useRef(null);
  const finaleActionsRef = useRef(null);
  useReveal(mainRef);

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
    <main ref={mainRef}>
      <Hero>
        <Container>
          <HeroEyebrow>Live quiz game for groups</HeroEyebrow>
          <Headline>
            <span className="line">Pick a topic.</span>{' '}
            <span className="line">Everyone plays —</span>{' '}
            <em className="line">including you.</em>
          </Headline>
          <Lead>
            Kazoot writes a 10-question quiz on the topic you choose. Friends join on their phones with a code — and because you haven’t seen the
            questions either, you get to play too.
          </Lead>
          <Actions ref={heroActionsRef} className="hero-actions">
            <DemoLink sheenOnLoad />
            <LinkButton to="/create" size="lg" variant="secondary" onStage>
              Create a quiz
            </LinkButton>
          </Actions>
          <Reassure className="hero-reassure">
            <span>
              <Icon name="check" /> Demo: no account, no card
            </span>
            <span>
              <Icon name="check" /> Your own topics: {config?.freeAiGamesPerMonth ?? 3} free quizzes a month
            </span>
          </Reassure>
          <DeviceStage />
        </Container>
      </Hero>

      <Section id="how-it-works">
        <Container>
          <H2>Ready in about a minute</H2>
          <Steps>
            <li data-reveal="" style={{ '--i': 0 }}>
              <TopicVignette />
              <div className="txt">
                <h3>Pick a topic</h3>
                <p>Type something like “Nordic mythology” or “90s pop”. Choose English or Estonian, the difficulty and the timer.</p>
              </div>
            </li>
            <li data-reveal="" style={{ '--i': 1 }}>
              <InviteVignette />
              <div className="txt">
                <h3>Invite</h3>
                <p>Players go to {window.location.host}/join and type the code, or scan the QR code on your screen. No app to install.</p>
              </div>
            </li>
            <li data-reveal="" style={{ '--i': 2 }}>
              <LeaderboardVignette />
              <div className="txt">
                <h3>Play</h3>
                <p>Everyone answers on their own device. Correct answers score more the faster they come. Standings after every question.</p>
              </div>
            </li>
          </Steps>
        </Container>
      </Section>

      <Section $band>
        <Container>
          <Split data-reveal="">
            <div>
              <h2>The organiser doesn’t have to sit out</h2>
              <p className="lead">
                Usually whoever writes the quiz knows every answer. With Kazoot, questions stay hidden until they appear on screen — for the host
                too. You start the game from your phone and compete like everyone else.
              </p>
            </div>
            <p className="note">
              <strong>Teaching or running a work session?</strong> Choose “Let me check first” to review and edit the questions before you start.
              Players see that the host has seen them.
            </p>
          </Split>
          <Answers>
            {SURFACED.map(([question, answer], index) => (
              <li key={question} data-reveal="" style={{ '--i': index, '--edge': SURFACED_EDGES[index] }}>
                <h3>{question}</h3>
                <p>{answer}</p>
              </li>
            ))}
          </Answers>
        </Container>
      </Section>

      <Section id="pricing" ref={pricingRef}>
        <Container>
          <PricingHead>
            <H2>Pricing</H2>
            <p>Start free. Pay only if you host often.</p>
          </PricingHead>
          <PricingBody data-reveal="">
            {plans ? <PlanGrid plans={plans} config={config} /> : <Muted role="status">Loading prices…</Muted>}
            <PricingExplainer />
          </PricingBody>
        </Container>
      </Section>

      <Section $band>
        <Questions>
          <H2 className="q-title">Questions</H2>
          <div className="q-know">
            <Eyebrow>Good to know</Eyebrow>
            <Know>
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
            </Know>
          </div>
          <div className="q-faq" data-reveal="">
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
            <More>
              Something else? Email <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.
            </More>
          </div>
        </Questions>
      </Section>

      <Finale data-stage-scope="">
        <Container>
          <div data-reveal="">
            <h2>See how it feels — the demo takes two minutes.</h2>
            <p>No account, no card. Play solo or with whoever is in the room.</p>
          </div>
          <Actions ref={finaleActionsRef}>
            <DemoLink />
            <LinkButton to="/join" size="lg" variant="secondary" onStage>
              Join a game
            </LinkButton>
          </Actions>
        </Container>
      </Finale>

      <MobileDock watchRefs={[heroActionsRef, finaleActionsRef]} />
    </main>
  );
}
