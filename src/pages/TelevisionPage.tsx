import React from 'react';
import ProgramasView from '../../components/ProgramasView';

interface TelevisionPageProps {
  isDarkMode?: boolean;
}

export const TelevisionPage: React.FC<TelevisionPageProps> = ({ isDarkMode = true }) => {
  return (
    <div className="w-full">
      <ProgramasView isDarkMode={isDarkMode} initialMode="televisao" />
    </div>
  );
};

export default TelevisionPage;
