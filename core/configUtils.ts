
import { ProjectConfig } from './types';

export const saveProjectConfig = (fileName: string | null, config: ProjectConfig) => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const baseName = fileName ? fileName.split('.')[0] : 'measurements';
    link.setAttribute("href", url);
    link.setAttribute("download", `${baseName}_Config.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const loadProjectConfig = async (file: File): Promise<ProjectConfig> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try { resolve(JSON.parse(e.target?.result as string)); }
            catch (err) { reject(new Error("Invalid format")); }
        };
        reader.readAsText(file);
    });
};
