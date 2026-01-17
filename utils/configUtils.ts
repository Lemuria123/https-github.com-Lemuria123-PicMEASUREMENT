import { ProjectConfig } from '../types';

export const saveProjectConfig = (fileName: string | null, config: ProjectConfig) => {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // 自动构建文件名: [原文件名]_MeasureConfig.json
    const baseName = fileName ? fileName.split('.')[0] : 'measurements';
    const finalFileName = `${baseName}_MeasureConfig.json`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", finalFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const loadProjectConfig = async (file: File): Promise<ProjectConfig> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                // 简单的版本校验或结构校验逻辑可以放在这里
                resolve(json as ProjectConfig);
            } catch (err) {
                reject(new Error("Invalid configuration file format."));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read the file."));
        reader.readAsText(file);
    });
};