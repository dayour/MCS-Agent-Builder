import React from "react";
import { View } from "@react-pdf/renderer";
import { SectionHeading, SubHeading, BulletList, Divider } from "../primitives";

interface Props {
  data: any;
  sectionNumber: number;
}

const ScopeBoundaries = ({ data, sectionNumber }: Props) => {
  if (!data) return null;

  const hasContent =
    data.handles?.length || data.politelyDeclines?.length || data.hardRefuses?.length;
  if (!hasContent) return null;

  return (
    <View>
      <SectionHeading number={sectionNumber} title="Scope & Boundaries" />

      {data.handles?.length > 0 && (
        <>
          <SubHeading>Handles</SubHeading>
          <BulletList items={data.handles} />
        </>
      )}

      {data.politelyDeclines?.length > 0 && (
        <>
          <SubHeading>Politely Declines</SubHeading>
          <BulletList items={data.politelyDeclines} />
        </>
      )}

      {data.hardRefuses?.length > 0 && (
        <>
          <SubHeading>Hard Refuses</SubHeading>
          <BulletList items={data.hardRefuses} />
        </>
      )}

      <Divider />
    </View>
  );
};

export default ScopeBoundaries;
