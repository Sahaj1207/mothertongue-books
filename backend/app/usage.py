"""Token and cost accounting for model calls, so spending is visible per book and capped per day."""

from contextvars import ContextVar
from dataclasses import dataclass, field

# USD per million tokens (input, output), from the providers' published prices.
PRICES = {
    "muse-spark-1.3": (1.25, 4.25),
    "meta-models/muse-spark-open-1026": (1.25, 4.25),
}


@dataclass
class UsageEntry:
    provider: str
    model: str
    agent: str
    input_tokens: int
    output_tokens: int
    # For usage billed by time rather than tokens (GPU drawing).
    fixed_cost_usd: float | None = None

    @property
    def cost_usd(self) -> float:
        if self.fixed_cost_usd is not None:
            return self.fixed_cost_usd
        price_in, price_out = PRICES.get(self.model, (0.0, 0.0))
        return (self.input_tokens * price_in + self.output_tokens * price_out) / 1_000_000


@dataclass
class UsageMeter:
    entries: list[UsageEntry] = field(default_factory=list)

    @property
    def cost_usd(self) -> float:
        return sum(e.cost_usd for e in self.entries)


current_meter: ContextVar[UsageMeter | None] = ContextVar("current_meter", default=None)


def record_usage(provider: str, model: str, agent: str, usage) -> None:
    """Add one call's usage to the meter of the book being made, if any."""
    meter = current_meter.get()
    if meter is None or usage is None:
        return
    meter.entries.append(
        UsageEntry(provider, model, agent, usage.prompt_tokens or 0, usage.completion_tokens or 0)
    )


def record_cost(provider: str, model: str, agent: str, cost_usd: float) -> None:
    """Add one time-billed call (no tokens) to the meter of the book being made, if any."""
    meter = current_meter.get()
    if meter is not None:
        meter.entries.append(UsageEntry(provider, model, agent, 0, 0, fixed_cost_usd=cost_usd))
