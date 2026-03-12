export interface KampusProjectInfo {
  name: string;
  description: string;
  repositoryUrl: string;
  homepageUrl: string;
}

export interface KampusDeveloperInfo {
  name: string;
  email?: string;
  url?: string;
}

export const KAMPUS_PROJECT_INFO: KampusProjectInfo = {
  name: 'Kampus',
  description: 'Korean Campus CLI - school information toolkit for Korea',
  repositoryUrl: 'https://github.com/4ndrxxs/Kampus',
  homepageUrl: 'https://github.com/4ndrxxs/Kampus#readme',
};

export const KAMPUS_DEVELOPER_INFO: KampusDeveloperInfo = {
  name: 'Juwon Seo',
  email: 'contact@seojuwon.com',
  url: 'https://github.com/4ndrxxs',
};
