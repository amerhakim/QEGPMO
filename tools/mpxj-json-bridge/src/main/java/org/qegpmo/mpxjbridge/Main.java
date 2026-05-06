package org.qegpmo.mpxjbridge;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.BufferedWriter;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.mpxj.Duration;
import org.mpxj.ProjectFile;
import org.mpxj.Relation;
import org.mpxj.RelationType;
import org.mpxj.Task;
import org.mpxj.TimeUnit;
import org.mpxj.reader.UniversalProjectReader;

/**
 * Minimal MPXJ reader emitting JSON aligned with {@code CanonicalSchedulePayload} on the Nest side.
 * Usage: {@code java -jar mpxj-json-bridge.jar read <path-to-file>}
 */
public final class Main {

    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();

    public static void main(String[] args) throws Exception {
        Locale.setDefault(Locale.ROOT);
        if (args.length < 2 || !"read".equalsIgnoreCase(args[0])) {
            System.err.println("Usage: java -jar mpxj-json-bridge.jar read <mpp-or-supported>");
            System.exit(2);
            return;
        }
        Path path = Path.of(args[1]);
        ProjectFile pf = new UniversalProjectReader().read(path.toFile());
        Map<String, Object> out = new LinkedHashMap<>();
        List<Map<String, Object>> tasksOut = new ArrayList<>();
        List<Map<String, Object>> linksOut = new ArrayList<>();
        List<Map<String, Object>> milestonesOut = new ArrayList<>();
        Set<String> unsupported = new LinkedHashSet<>();
        List<String> warnings = new ArrayList<>();

        unsupported.add("RESOURCE_ASSIGNMENTS_NOT_IMPORTED");
        unsupported.add("CALENDARS_NOT_IMPORTED");
        unsupported.add("COST_FIELDS_NOT_IMPORTED");

        for (Task t : pf.getTasks()) {
            Integer uid = t.getUniqueID();
            if (uid == null) {
                continue;
            }

            Task parent = t.getParentTask();
            Integer parentUid = parent == null ? null : parent.getUniqueID();

            LocalDateTime start = t.getStart();
            LocalDateTime finish = t.getFinish();
            Integer pct = t.getPercentageComplete();

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("externalUid", uid);
            row.put("outlineNumber", nz(t.getOutlineNumber()));
            row.put("outlineLevel", t.getOutlineLevel() == null ? 1 : t.getOutlineLevel());
            row.put("parentExternalUid", parentUid);
            row.put("name", nz(t.getName()));
            row.put("plannedStart", iso(start));
            row.put("plannedFinish", iso(finish));
            double effort = durationHours(t.getWork());
            if (effort <= 0d) {
                effort = durationHours(t.getDuration());
            }
            row.put("plannedEffortHours", effort);
            row.put("percentComplete", pct == null ? 0 : pct);
            row.put("milestone", Boolean.TRUE.equals(t.getMilestone()));
            row.put("actualStart", iso(t.getActualStart()));
            row.put("actualFinish", iso(t.getActualFinish()));

            LocalDateTime bStart = t.getBaselineStart();
            LocalDateTime bFinish = t.getBaselineFinish();
            Duration bDur = t.getBaselineDuration();
            row.put("baselineStart", iso(bStart));
            row.put("baselineFinish", iso(bFinish));
            row.put("baselineEffortHours", bDur == null ? null : durationHours(bDur));

            tasksOut.add(row);

            if (Boolean.TRUE.equals(t.getMilestone())) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("externalUid", uid);
                m.put("code", "MSP-M-" + uid);
                m.put("name", nz(t.getName()));
                m.put("plannedDate", iso(finish != null ? finish : start));
                milestonesOut.add(m);
            }
        }

        Set<String> seenLinks = new LinkedHashSet<>();
        for (Task succ : pf.getTasks()) {
            if (succ.getUniqueID() == null) {
                continue;
            }
            for (Relation rel : succ.getPredecessors()) {
                Task pred = rel.getPredecessorTask();
                if (pred == null || pred.getUniqueID() == null || succ.getUniqueID() == null) {
                    continue;
                }
                String key = pred.getUniqueID() + "->" + succ.getUniqueID() + ":" + rel.getType();
                if (!seenLinks.add(key)) {
                    continue;
                }
                Map<String, Object> link = new LinkedHashMap<>();
                link.put("predecessorUid", pred.getUniqueID());
                link.put("successorUid", succ.getUniqueID());
                link.put("dependencyType", relationType(rel.getType()));
                link.put("lagDays", lagDays(rel.getLag()));
                Integer lid = rel.getUniqueID();
                if (lid != null) {
                    link.put("externalLinkUid", lid);
                }
                linksOut.add(link);
            }
        }

        out.put("tasks", tasksOut);
        out.put("links", linksOut);
        out.put("milestones", milestonesOut);
        out.put(
                "unsupportedFields",
                unsupported.stream().sorted().toList());
        out.put("warnings", warnings);

        try (BufferedWriter w =
                     new BufferedWriter(new OutputStreamWriter(System.out, StandardCharsets.UTF_8))) {
            GSON.toJson(out, w);
        }
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String iso(LocalDateTime dt) {
        if (dt == null) {
            return null;
        }
        return dt.atOffset(ZoneOffset.UTC).format(DateTimeFormatter.ISO_INSTANT);
    }

    private static double durationHours(Duration d) {
        if (d == null) {
            return 0d;
        }
        double mins =
                d.getUnits() == TimeUnit.MINUTES ? d.getDuration() : d.convertUnits(TimeUnit.MINUTES).getDuration();
        double hrs = mins / 60d;
        return Math.round(hrs * 100d) / 100d;
    }

    private static int lagDays(Duration lag) {
        if (lag == null) {
            return 0;
        }
        double mins =
                lag.getUnits() == TimeUnit.MINUTES ? lag.getDuration() : lag.convertUnits(TimeUnit.MINUTES).getDuration();
        return (int) Math.round((mins / 60d) / 8d);
    }

    private static String relationType(RelationType type) {
        if (type == null) {
            return "FS";
        }
        switch (type) {
            case START_START:
                return "SS";
            case FINISH_FINISH:
                return "FF";
            case START_FINISH:
                return "SF";
            case FINISH_START:
                return "FS";
            default:
                return "FS";
        }
    }
}
