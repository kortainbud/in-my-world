import { CREDIT_COSTS, estimateCredits } from "@/config/plans";
import { DURATIONS } from "@/lib/engine/types";

/** Credit cost table, computed from the same config the server charges with. */
export function CreditTable() {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-line-soft">
      <table className="w-full min-w-[460px] text-left text-small">
        <thead className="bg-bg-2 text-caption text-fg-3">
          <tr>
            <th className="px-4 py-2.5 font-normal">Video length</th>
            <th className="px-4 py-2.5 font-normal">Story + render</th>
            <th className="px-4 py-2.5 font-normal">Narration</th>
            <th className="px-4 py-2.5 font-normal">Total at 720p</th>
            <th className="px-4 py-2.5 font-normal">Total at 1080p</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {DURATIONS.map((d) => (
            <tr key={d}>
              <td className="px-4 py-2.5 font-medium">{d} seconds</td>
              <td className="px-4 py-2.5 text-fg-2">{CREDIT_COSTS.base[d]}</td>
              <td className="px-4 py-2.5 text-fg-2">+{CREDIT_COSTS.narration[d]}</td>
              <td className="px-4 py-2.5">{estimateCredits({ duration: d, style: "roblox", narration: true, exportHeight: 720 }).total}</td>
              <td className="px-4 py-2.5">{estimateCredits({ duration: d, style: "roblox", narration: true, exportHeight: 1080 }).total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line-soft px-4 py-3 text-caption leading-relaxed text-fg-3">
        Credits are held when you start a video and refunded automatically if it fails. Your plan’s monthly allowance arrives at the start of each billing period; unused allowance doesn’t roll over. Purchased credit packs don’t expire. Export quality follows your plan.
      </p>
    </div>
  );
}
