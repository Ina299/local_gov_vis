/** Offline source navigation. No normalized numeric values or completeness claim. */
export type SourceVerification = 'verified' | 'official_host_only' | 'unverified';
export type EvidenceStatus = 'text_available' | 'sources_available' | 'official_fallback_only' | 'no_verified_sources';
export type DiscoveryStatus = 'not_searched' | 'searched_not_found' | 'discovered' | 'fetched' | 'structured' | 'blocked' | 'unsupported';
export interface OfficialLink {
    url: string;
    title: string;
    kind: 'official_homepage' | 'official_directory_page';
    verificationBasis: string;
    evidenceUrl: string;
    evidenceSha256: string;
}
export interface MunicipalityIdentity {
    municipalityCode: string;
    municipalityName: string;
    prefectureCode: string;
    prefectureName: string;
}
export interface IndexEntry extends MunicipalityIdentity {
    shardPath: string;
    shardSha256: string;
    shardBytes: number;
    discoveryStatus: DiscoveryStatus;
    evidenceStatus: EvidenceStatus;
    evaluationPageCount: number;
    sourceCount: number;
    candidateCount: number;
    acquiredCount: number;
    textDocumentCount: number;
    substantiveTextDocumentCount: number;
    officialHomepage: OfficialLink | null;
    officialFallback: OfficialLink | null;
}
export interface YearEvidence {
    label: string;
    calendarYear: number;
    meaning: 'evaluation_year' | 'fiscal_year_mentioned' | 'calendar_year_mentioned' | 'unknown';
    basis: 'source_title' | 'official_link_label' | 'printed_text';
    quote: string;
}
export interface EvidenceSource {
    id: string;
    url: string;
    title: string;
    titleBasis: 'html_title' | 'official_link_label' | 'inventory_title' | 'source_filename';
    format: string;
    evaluationType: 'business_project_evaluation' | 'policy_evaluation' | 'facility_evaluation' | 'education_inspection' | 'mixed_evaluation' | 'grant_project_evaluation' | 'administrative_reform' | 'project_activity_report' | 'sector_evaluation' | 'unknown';
    navigationReview?: {
        method: 'official_body_review' | 'search_candidate';
        checkedAt: string;
        publisher: string;
        evidenceUrl: string;
        originEvidenceUrl: string | null;
        notes: string;
        yearNotes: string;
        /** 'collected': original bytes were saved by a later source-collection run. */
        rawArchiveState: 'not_downloaded' | 'collected';
    };
    role: 'evaluation_landing_page' | 'evaluation_document' | 'supporting_document' | 'official_page' | 'candidate';
    verification: {
        status: SourceVerification;
        basis: string[];
        evidenceSourceId: string | null;
        evidenceSha256: string | null;
        evaluationRelevance: 'verified' | 'not_established';
    };
    acquisition: {
        state: 'acquired' | 'blocked' | 'failed' | 'discovered' | 'cache_missing' | 'hash_mismatch' | 'format_integrity_hold';
        inputStatus: DiscoveryStatus;
        method: 'network' | 'archive_member';
        containerSha256: string | null;
        memberPath: string | null;
        memberIndex: number | null;
        fetchedAt: string | null;
        httpStatus: number | null;
        sourceSha256: string | null;
    };
    text: {
        status: 'available' | 'not_acquired' | 'not_extracted' | 'no_readable_text' | 'verification_pending' | 'format_integrity_hold' | 'sanitization_hold';
        label: 'unstructured_source_text';
        preview: string | null;
        assetPath: string | null;
        assetBytes: number;
        assetSha256: string | null;
        characters: number;
        exportedCharacters: number;
        truncated: boolean;
        textSha256: string | null;
        inputTextSha256: string | null;
        extractionMethod: string | null;
    };
    years: YearEvidence[];
}
export interface MunicipalityEvidence {
    schemaVersion: 1;
    municipality: MunicipalityIdentity;
    discovery: {
        status: DiscoveryStatus;
        initialLook: boolean;
        searchAttemptsCount: number;
        coverageCompleteness: 'not_established';
        omittedRejectedSources: number;
    };
    officialHomepage: OfficialLink | null;
    officialFallback: OfficialLink | null;
    officialDirectoryLinks: OfficialLink[];
    evaluationPages: string[];
    sources: EvidenceSource[];
}
export interface DocumentText {
    schemaVersion: 1;
    sourceId: string;
    municipalityCode: string;
    sourceUrl: string;
    sourceSha256: string;
    acquisitionMethod: 'network' | 'archive_member';
    containerSha256: string | null;
    memberPath: string | null;
    memberIndex: number | null;
    label: 'unstructured_source_text';
    text: string;
    characters: number;
    exportedCharacters: number;
    truncated: boolean;
    textSha256: string;
    inputTextSha256: string | null;
    extractionMethod: string;
}
export interface EvidenceIndex {
    schemaVersion: 1;
    scopeMunicipalities: 1741;
    snapshotAt: string;
    counts: Record<string, number>;
    municipalities: IndexEntry[];
}
