import React from "react";
import { View } from "@react-pdf/renderer";
import {
  SectionHeading, SubHeading, Paragraph, BulletList,
  DataTable, Divider, Spacer, safe,
} from "../primitives";

interface Props {
  data: any;
  sectionNumber: number;
}

const BusinessContext = ({ data, sectionNumber }: Props) => {
  if (!data) return null;
  return (
    <View>
      <SectionHeading number={sectionNumber} title="Business Context" />

      {data.problemStatement && (
        <>
          <SubHeading>Problem Statement</SubHeading>
          <Paragraph>{data.problemStatement}</Paragraph>
          <Spacer />
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

      {data.successCriteria?.length > 0 && (
        <>
          <SubHeading>Success Criteria</SubHeading>
          <DataTable
            columns={[
              { header: "Metric", flex: 3 },
              { header: "Target", flex: 2 },
              { header: "Current", flex: 2 },
            ]}
            rows={data.successCriteria.map((s: any) => [
              safe(s.metric), safe(s.target), safe(s.current),
            ])}
          />
        </>
      )}

      {data.stakeholders?.length > 0 && (
        <>
          <SubHeading>Stakeholders</SubHeading>
          <DataTable
            columns={[
              { header: "Name", flex: 2 },
              { header: "Role", flex: 3 },
              { header: "Type", flex: 1 },
            ]}
            rows={data.stakeholders.map((s: any) => [
              safe(s.name), safe(s.role), safe(s.type),
            ])}
          />
        </>
      )}

      <Divider />
    </View>
  );
};

export default BusinessContext;
