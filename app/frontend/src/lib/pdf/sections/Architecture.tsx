import React from "react";
import { View } from "@react-pdf/renderer";
import {
  SectionHeading, SubHeading, BulletList,
  Callout, KeyValue, DataTable, Divider, safe,
} from "../primitives";

interface Props {
  data: any;
  sectionNumber: number;
}

const Architecture = ({ data, sectionNumber }: Props) => {
  if (!data) return null;
  return (
    <View>
      <SectionHeading number={sectionNumber} title="Architecture" />

      <KeyValue label="Pattern" value={data.pattern} />
      {data.patternReasoning && <Callout>{data.patternReasoning}</Callout>}

      {data.triggers?.length > 0 && (
        <>
          <SubHeading>Triggers</SubHeading>
          <BulletList
            items={data.triggers.map(
              (t: any) => `${safe(t.type)}: ${safe(t.description)}`,
            )}
          />
        </>
      )}

      {data.channels?.length > 0 && (
        <>
          <SubHeading>Channels</SubHeading>
          <DataTable
            columns={[
              { header: "Channel", flex: 2 },
              { header: "Reason", flex: 3 },
            ]}
            rows={data.channels.map((c: any) => [safe(c.name), safe(c.reason)])}
          />
        </>
      )}

      {data.childAgents?.length > 0 && (
        <>
          <SubHeading>Child Agents</SubHeading>
          <DataTable
            columns={[
              { header: "Agent", flex: 2 },
              { header: "Role", flex: 3 },
            ]}
            rows={data.childAgents.map((c: any) => [safe(c.name), safe(c.role)])}
          />
        </>
      )}

      {data.scoring?.length > 0 && (
        <>
          <SubHeading>Complexity Scoring</SubHeading>
          <DataTable
            columns={[
              { header: "Factor", flex: 3 },
              { header: "Score", flex: 1 },
              { header: "Notes", flex: 3 },
            ]}
            rows={data.scoring.map((s: any) => [
              safe(s.factor),
              `${safe(s.score)}/10`,
              safe(s.notes),
            ])}
          />
        </>
      )}

      <Divider />
    </View>
  );
};

export default Architecture;
