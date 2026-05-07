import React from 'react';
import { useDW } from '../context/DWContext';
import { DWOverviewTab } from '../components/DWOverviewTab';
import { DWTasksTab } from '../components/DWTasksTab';
import { DWKnowledgeTab } from '../components/DWKnowledgeTab';
import { DWMessagesTab } from '../components/DWMessagesTab';
import { DWContentTab } from '../components/DWContentTab';
import { DWDetailsTab } from '../components/DWDetailsTab';
import { DWOrganizationTab } from '../components/DWOrganizationTab';

export const DWBuildPage: React.FC = () => {
  const { dwTab, day0AnimKey } = useDW();

  return (
    <div className="w-full flex-1 flex flex-col">
      {dwTab === 'overview' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1024px] w-full mx-auto px-8 pt-[18px] pb-8">
            <DWOverviewTab />
          </div>
        </div>
      )}
      {dwTab === 'tasks' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="max-w-[1024px] w-full mx-auto px-8 pt-[18px] pb-8 flex flex-col flex-1 min-h-0">
            <DWTasksTab key={day0AnimKey} />
          </div>
        </div>
      )}
      {dwTab === 'knowledge' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1024px] w-full mx-auto px-8 pt-[18px] pb-8">
            <DWKnowledgeTab />
          </div>
        </div>
      )}
      {dwTab === 'messages' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="max-w-[1024px] w-full mx-auto px-8 pt-[18px] pb-8 flex flex-col flex-1 min-h-0">
            <DWMessagesTab />
          </div>
        </div>
      )}
      {dwTab === 'content' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="max-w-[1024px] w-full mx-auto px-8 pt-[18px] pb-8 flex flex-col flex-1 min-h-0">
            <DWContentTab />
          </div>
        </div>
      )}
      {dwTab === 'details' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1024px] w-full mx-auto px-8 pt-[18px] pb-8">
            <DWDetailsTab />
          </div>
        </div>
      )}
      {dwTab === 'organization' && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1024px] w-full mx-auto px-8 pt-[18px] pb-8">
            <DWOrganizationTab />
          </div>
        </div>
      )}
    </div>
  );
};
