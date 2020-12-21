import type { Ref } from "react";

export declare interface TranscriptEditorProps {
    transcriptData: any;
    mediaUrl: string;
    handleAutoSaveChanges?: (data: any) => void;
    autoSaveContentType?: "digitalpaperedit" | "sttJsonType" | "draftjs";
    isEditable?: boolean;
    spellCheck?: boolean;
    sttJsonType?: string;
    handleAnalyticsEvents?: (event: { category: string; action: string; name: string; value: any }) => void;
    fileName?: string;
    title?: string;
    ref?: Ref;
    mediaType?: "video" | string;
}

export declare type TranscriptEditorT = (props: TranscriptEditorProps) => JSX.Element;