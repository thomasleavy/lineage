import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 18,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 10,
    color: '#555',
    marginBottom: 20,
  },
  versionBlock: {
    marginTop: 14,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 2,
  },
  versionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  versionNumber: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    fontSize: 9,
  },
  meta: {
    fontSize: 9,
    color: '#555',
    marginBottom: 4,
  },
  summary: {
    marginTop: 4,
    marginBottom: 2,
    fontWeight: 'bold',
  },
  detail: {
    marginTop: 2,
    fontSize: 9,
    color: '#333',
    whiteSpace: 'pre-wrap',
  },
  snapshot: {
    marginTop: 6,
    padding: 6,
    backgroundColor: '#eee',
    fontSize: 8,
    fontFamily: 'Courier',
  },
  imagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  imageWrap: {
    width: 120,
    alignItems: 'center',
  },
  versionImage: {
    width: 120,
    height: 120,
    objectFit: 'cover',
  },
  imageCaption: {
    fontSize: 8,
    color: '#555',
    marginTop: 2,
    maxWidth: 120,
  },
});

export type VersionForPdf = {
  versionNumber: number;
  createdAt: Date;
  createdByName: string;
  changeSummary: string | null;
  changeDetail: string | null;
  status: string;
  snapshotJson: Record<string, unknown>;
  isCurrent: boolean;
  images: { dataUrl: string; originalFilename: string }[];
};

type GarmentVersionHistoryDocProps = {
  houseCode: string;
  collection: string;
  category: string;
  status: string;
  versions: VersionForPdf[];
  generatedAt: string;
};

function formatDate(d: Date): string {
  return new Date(d).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function GarmentVersionHistoryDocument({
  houseCode,
  collection,
  category,
  status,
  versions,
  generatedAt,
}: GarmentVersionHistoryDocProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Version history — {houseCode}</Text>
        <Text style={styles.subtitle}>
          {collection} · {category} · {status} · Generated {generatedAt}
        </Text>
        {versions.map((v) => (
          <View key={v.versionNumber} style={styles.versionBlock} wrap={false}>
            <View style={styles.versionHeader}>
              <Text style={styles.versionNumber}>Version {v.versionNumber}</Text>
              <Text style={styles.badge}>{v.status}</Text>
              {v.isCurrent && <Text style={styles.badge}>Current</Text>}
            </View>
            <Text style={styles.meta}>
              {formatDate(v.createdAt)} · {v.createdByName}
            </Text>
            {v.changeSummary != null && v.changeSummary.trim() !== '' && (
              <Text style={styles.summary}>{v.changeSummary}</Text>
            )}
            {v.changeDetail != null && v.changeDetail.trim() !== '' && (
              <Text style={styles.detail}>{v.changeDetail}</Text>
            )}
            {v.images.length > 0 && (
              <View style={styles.imagesRow}>
                {v.images.map((img, idx) => (
                  <View key={idx} style={styles.imageWrap}>
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image has no alt prop */}
                    <Image src={img.dataUrl} style={styles.versionImage} />
                    <Text style={styles.imageCaption}>{img.originalFilename}</Text>
                  </View>
                ))}
              </View>
            )}
            {Object.keys(v.snapshotJson).length > 0 && (
              <Text style={styles.snapshot}>
                {JSON.stringify(v.snapshotJson, null, 2)}
              </Text>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
}
