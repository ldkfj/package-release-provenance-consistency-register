import os
import sys
import tempfile
from pathlib import Path

from gltest.direct.sdk_loader import setup_sdk_paths
from gltest.direct.vm import VMContext

CONTRACT_PATH = Path(__file__).parents[1] / "contracts" / "package_release_provenance_consistency_register.py"
setup_sdk_paths(CONTRACT_PATH)
sys.path.insert(0, str(CONTRACT_PATH.parent))

for module_name in tuple(sys.modules):
    if module_name == "genlayer" or module_name.startswith("genlayer."):
        del sys.modules[module_name]


def cleanup_preserving_pinned_sdk(self) -> None:
    self._warn_unused_mocks()
    original_stdin = getattr(self, "_original_stdin_fd", None)
    if original_stdin is not None:
        try:
            os.dup2(original_stdin, 0)
            os.close(original_stdin)
        except OSError:
            pass
        self._original_stdin_fd = None


VMContext._cleanup_after_deactivate = cleanup_preserving_pinned_sdk

from gltest.direct import wasi_mock

sys.modules["_genlayer_wasi"] = wasi_mock

from genlayer.py import calldata
from genlayer.py.types import Address

ZERO = Address("0x0000000000000000000000000000000000000000")
dummy = calldata.encode(
    {
        "contract_address": ZERO.as_bytes,
        "sender_address": ZERO.as_bytes,
        "origin_address": ZERO.as_bytes,
        "value": 0,
        "chain_id": 61999,
        "is_init": False,
    }
)
bootstrap_file = tempfile.TemporaryFile()  # noqa: SIM115 — must outlive fd 0.
bootstrap_file.write(dummy)
bootstrap_file.seek(0)
os.dup2(bootstrap_file.fileno(), 0)
