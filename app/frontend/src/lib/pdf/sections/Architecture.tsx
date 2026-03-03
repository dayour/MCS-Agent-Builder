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
              { header: "Routing Rule", flex: 3 },
            ]}
            rows={data.childAgents.map((c: any) => [safe(c.name), safe(c.role), safe(c.routingRule)])}
          />
        </>
      )}

      {data.scoring?.length > 0 && (
        <>
          <SubHeading>
            {`Architecture Score (${data.scoring.reduce((s: number, f: any) => s + (f.score || 0), 0)}/6)`}
          </SubHeading>
          <DataTable
            columns={[
              { header: "Factor", flex: 2 },
              { header: "Applies", flex: 1 },
              { header: "Notes", flex: 3 },
            ]}
            rows={data.scoring.map((f: any) => [safe(f.factor), f.score ? "Yes" : "No", safe(f.notes)])}
          />
        </>
      )}

      <Divider />
    </View>
  );
};

export default Architecture;
