import React from "react";
import { View } from "@react-pdf/renderer";
import { SectionHeading, CodeBlock, Divider } from "../primitives";

interface Props {
  data: any;
  sectionNumber: number;
}

const Instructions = ({ data, sectionNumber }: Props) => {
  if (!data?.systemPrompt) return null;
  return (
    <View>
      <SectionHeading number={sectionNumber} title="Instructions" />
      <CodeBlock>{data.systemPrompt}</CodeBlock>
      <Divider />
    </View>
  );
};

export default Instructions;
