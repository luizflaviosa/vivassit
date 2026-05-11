import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

class SyncCache {
  static const _dbName = 'singulare_sync.db';
  Database? _db;

  Future<Database> _open() async {
    if (_db != null) return _db!;
    final dir = await getDatabasesPath();
    _db = await openDatabase(
      p.join(dir, _dbName),
      version: 1,
      onCreate: (db, v) async {
        await db.execute('''
          create table sync_state (
            loinc_code text primary key,
            last_sync_at text not null
          )
        ''');
      },
    );
    return _db!;
  }

  Future<DateTime?> getLastSync(String loinc) async {
    final db = await _open();
    final rows = await db.query('sync_state', where: 'loinc_code = ?', whereArgs: [loinc], limit: 1);
    if (rows.isEmpty) return null;
    return DateTime.parse(rows.first['last_sync_at'] as String);
  }

  Future<void> setLastSync(String loinc, DateTime at) async {
    final db = await _open();
    await db.insert(
      'sync_state',
      {'loinc_code': loinc, 'last_sync_at': at.toUtc().toIso8601String()},
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<DateTime> getOldestSyncOrDefault(List<String> codes, Duration fallback) async {
    DateTime? oldest;
    for (final c in codes) {
      final t = await getLastSync(c);
      if (t == null) return DateTime.now().subtract(fallback);
      if (oldest == null || t.isBefore(oldest)) oldest = t;
    }
    return oldest!;
  }
}
