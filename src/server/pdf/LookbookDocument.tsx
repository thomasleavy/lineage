import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
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
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 8,
  },
  lookName: {
    fontSize: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  label: {
    width: 120,
    color: '#555',
  },
  value: {
    flex: 1,
  },
  itemBlock: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 2,
  },
  redacted: {
    color: '#999',
    fontStyle: 'italic',
  },
});

type LookItem = {
  orderIndex: number;
  summary: string | null;
  detail: string | null;
  garment: {
    houseCode: string;
    collection: string;
    category: string;
    status: string;
  };
};

type LookDocProps = {
  lookName: string;
  collection: string;
  type: 'run_of_show' | 'press';
  items: LookItem[];
  redactInternal: boolean;
};

export function LookbookDocument({
  lookName,
  collection,
  type,
  items,
  redactInternal,
}: LookDocProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          LINEAGE Lookbook — {lookName} ({collection})
        </Text>
        <Text style={{ marginBottom: 16 }}>
          Type: {type === 'press' ? 'Press' : 'Run of show'} • Generated {new Date().toLocaleDateString()}
        </Text>
        {items
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((item, i) => (
            <View key={item.orderIndex} style={styles.itemBlock} wrap={false}>
              <Text style={styles.lookName}>
                Look {i + 1} — {item.garment.houseCode}
              </Text>
              <View style={styles.row}>
                <Text style={styles.label}>House code</Text>
                <Text style={styles.value}>{item.garment.houseCode}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Category</Text>
                <Text style={styles.value}>{item.garment.category}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Collection</Text>
                <Text style={styles.value}>{item.garment.collection}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Status</Text>
                <Text style={styles.value}>{item.garment.status}</Text>
              </View>
              {!redactInternal && (
                <>
                  <View style={styles.row}>
                    <Text style={styles.label}>Summary</Text>
                    <Text style={styles.value}>{item.summary ?? '—'}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Detail</Text>
                    <Text style={styles.value}>
                      {item.detail ?? '—'}
                    </Text>
                  </View>
                </>
              )}
              {redactInternal && (
                <View style={styles.row}>
                  <Text style={[styles.value, styles.redacted]}>
                    [Internal notes redacted for press]
                  </Text>
                </View>
              )}
            </View>
          ))}
      </Page>
    </Document>
  );
}
