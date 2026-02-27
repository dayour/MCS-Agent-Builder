import React from "react";
import { View } from "@react-pdf/renderer";
import {
  SectionHeading, SubHeading, Paragraph, BulletList,
  KeyValue, Divider, Spacer,
} from "../primitives";

interface Props {
  data: any;
  sectionNumber: number;
}

const Overview = ({ data, sectionNumber }: Props) => {
  if (!data) return null;
  return (
    <View>
      <SectionHeading number={sectionNumber} title="Overview" />

      <KeyValue label="Name" value={data.name} />
      {data.description && <Paragraph>{data.description}</Paragraph>}

      {data.problemStatement && (
        <>
          <SubHeading>Problem Statement</SubHeading>
          <Paragraph>{data.problemStatement}</Paragraph>
          <Spacer />
        </>
      )}

      {data.targetUsers?.length > 0 && (
        <>
          <SubHeading>Target Users</SubHeading>
          <BulletList items={data.targetUsers} />
        </>
      )}

      {data.challenges?.length > 0 && (
        <>
          <SubHeading>Key Challenges</SubHeading>
          <BulletList items={data.challenges} />
        </>
      )}

      {data.benefits?.length > 0 && (
        <>
          <SubHeading>Expected Benefits</SubHeading>
          <BulletList items={data.benefits} />
        </>
      )}

      <Divider />
    </View>
  );
};

export default Overview;
