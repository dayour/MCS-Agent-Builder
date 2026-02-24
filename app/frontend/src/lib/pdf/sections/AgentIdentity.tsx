import React from "react";
import { View } from "@react-pdf/renderer";
import {
  SectionHeading, SubHeading, Paragraph, BulletList,
  Callout, KeyValue, Divider,
} from "../primitives";

interface Props {
  data: any;
  sectionNumber: number;
}

const AgentIdentity = ({ data, sectionNumber }: Props) => {
  if (!data) return null;
  return (
    <View>
      <SectionHeading number={sectionNumber} title="Agent Identity" />

      <KeyValue label="Name" value={data.name} />
      {data.description && <Paragraph>{data.description}</Paragraph>}

      {data.persona && (
        <>
          <SubHeading>Persona</SubHeading>
          <Callout>{data.persona}</Callout>
        </>
      )}

      {data.targetUsers?.length > 0 && (
        <>
          <SubHeading>Target Users</SubHeading>
          <BulletList items={data.targetUsers} />
        </>
      )}

      <Divider />
    </View>
  );
};

export default AgentIdentity;
