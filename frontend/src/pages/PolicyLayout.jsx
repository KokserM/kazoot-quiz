import React from 'react';
import { Link } from 'react-router-dom';
import { Button, ButtonRow, Card, GlassPanel, PanelBody, PanelTitleHeader, SectionTitle, Stack, Subtitle } from '../components/ui';

export function PolicyLayout({ title, summary, sections }) {
  return (
    <GlassPanel initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
      <PanelTitleHeader>
        <SectionTitle>{title}</SectionTitle>
      </PanelTitleHeader>
      <PanelBody>
        <Stack gap="18px">
          <Card initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Subtitle>{summary}</Subtitle>
            <ButtonRow style={{ marginTop: 18 }}>
              <Button as={Link} to="/account" variant="secondary" compact>
                Account and billing
              </Button>
              <Button as={Link} to="/" variant="ghost" compact>
                Back home
              </Button>
            </ButtonRow>
          </Card>
          {sections.map((section) => (
            <Card key={section.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SectionTitle style={{ fontSize: '1.2rem' }}>{section.title}</SectionTitle>
              <Subtitle style={{ marginTop: 8 }}>{section.body}</Subtitle>
            </Card>
          ))}
        </Stack>
      </PanelBody>
    </GlassPanel>
  );
}
